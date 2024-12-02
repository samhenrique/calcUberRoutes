import { PrismaClient } from '@prisma/client';
import amqplib from 'amqplib';
import AWS from 'aws-sdk';
import { spawn } from 'child_process';
import cors from "cors";
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import h3 from 'h3-js';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const topicArn = process.env.TOPIC_ARN;
const queueUrl = process.env.QUEUE_URL;
const rabbitmqUrl = process.env.RABBITMQ_URL;
const rabbitmqUser = process.env.RABBITMQ_USER;
const rabbitmqPassword = process.env.RABBITMQ_PASSWORD;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const corsOptions = {
  origin: "*", // Permite todas as origens; modifique conforme necessário para segurança
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: "Content-Type,Authorization",
};

const app = express();
app.use(express.json());
const list = []

const prisma = new PrismaClient({
  transactionOptions: {
    timeout: 60000,
  },
});

app.use(cors(corsOptions));

AWS.config.update({
    accessKeyId,
    secretAccessKey,
    region: 'sa-east-1', 
  });

const sns = new AWS.SNS();

app.get('/', (req, res) => {
  res.send(list);
});

app.post('/insert', (req, res) => {
  list.push(req.body);
  res.status(201).send(req.body + ' inserido com sucesso!');
});

app.get('/retrain-model', (req, res) => {
  const pythonArgs = ["./src/scripts/train_model.py"];
  const pythonProcess = spawn('.venv/Scripts/python', pythonArgs);

  pythonProcess.on('close', async (code) => {
    if (code !== 0) {
      return res.status(500).send({ error: 'Erro ao executar o script Python.' });
    }
    const params = {
        Message: 'Modelo retreinado com sucesso!',
        TopicArn: topicArn,
      };
      
      sns.publish(params, (err, data) => {
        if (err) {
          console.error('Erro ao enviar mensagem:', err);
        } else {
          console.log('Mensagem enviada com sucesso:', data);
        }
      });
      
    res.status(200).send('Modelo retreinado com sucesso!');
  });
});

app.post('/', async (req, res) => {
  const { latOrigin, lngOrigin, latDest, lngDest} = req.body;
  const origin = h3.latLngToCell(latOrigin, lngOrigin, 15);
  const destination = h3.latLngToCell(latDest, lngDest, 15);
  console.log(origin, destination);
  const pythonArgs = ["./src/scripts/predict.py", origin, destination];
  const pythonProcess = spawn('.venv/Scripts/python', pythonArgs);

  let pythonOutput = '';
  pythonProcess.stdout.on('data', (data) => {
    pythonOutput += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error('Erro no script Python:', data.toString());
  });
  pythonProcess.on('close', async (code) => {
    if (code !== 0) {
      return res.status(500).send({ error: 'Erro ao executar o script Python.' });
    }

    console.log('Resultado da predição:', pythonOutput);

    const data = await prisma.taxiTrips.create({ data: {
      fareAmount: parseFloat(pythonOutput.trim()),
      pickupDate: new Date(),
      pickupLatitude: latOrigin,
      pickupLongitude: lngOrigin,
      dropoffLatitude: latDest,
      dropoffLongitude: lngDest
    } });

    // Enviar o resultado da predição para o cliente
    res.status(200).json(data);
  });


    // res.status(201).send(origin + ' ' + destination);

});

async function connectToActiveMQ() {
  try {
    const connection = await amqplib.connect({
      protocol: 'amqps',
      hostname: rabbitmqUrl,
      port: 5671,
      username: rabbitmqUser,
      password: rabbitmqPassword,
      frameMax: 4194304,
    });
    const channel = await connection.createChannel();

    await channel.assertQueue(queueUrl, { durable: true });
    await channel.prefetch(10); 

    console.log('Connected to ActiveMQ on queue "data"');

    const messages = [];

    await channel.consume(queueUrl, async (message) => {
      const content = message.content.toString();
      console.log('Received message:', content);
      messages.push(content);
      channel.ack(message);
    }, { noAck: false });


    const csv = messages.join('\n');

    fs.mkdirSync(path.join(__dirname, 'tmp'), { recursive: true });
    const filePath = path.join(__dirname, 'tmp', 'cleaned_2.csv');
    fs.writeFileSync(filePath, csv);

    console.log('CSV file saved:', filePath);
  } catch (error) {
    console.error('Error connecting to ActiveMQ:', error);
  }
}

connectToActiveMQ();

export default app; 