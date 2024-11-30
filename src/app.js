import { PrismaClient } from '@prisma/client';
import amqplib from 'amqplib';
import { spawn } from 'child_process';
import cors from "cors";
import express from 'express';
import h3 from 'h3-js';

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

app.get('/', (req, res) => {
  res.send(list);
});

app.post('/insert', (req, res) => {
  list.push(req.body);
  res.status(201).send(req.body + ' inserido com sucesso!');
});

app.post('/retrain-model', (req, res) => {
  res.send('Not implemented yet');
});

app.post('/', async (req, res) => {
  const { latOrigin, lngOrigin, latDest, lngDest} = req.body;
  const origin = h3.latLngToCell(latOrigin, lngOrigin, 9);
  const destination = h3.latLngToCell(latDest, lngDest, 9);
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
    'amqps://admin:Th1234567890@b-515e6f12-ea9f-46bb-9263-330132968f52-1.mq.us-east-2.amazonaws.com:5671'
    const connection = await amqplib.connect({
      protocol: 'amqps',
      hostname: 'b-515e6f12-ea9f-46bb-9263-330132968f52-1.mq.us-east-2.amazonaws.com',
      port: 5671,
      username: 'admin',
      password: 'Th1234567890',
      frameMax: 4194304,
    });
    const channel = await connection.createChannel();

    await channel.assertQueue('data', { durable: true });

    console.log('Connected to ActiveMQ on queue "data"');

    channel.consume('data', async (message) => {
      console.log('Received message:', message.content.toString());
    }, { noAck: false });
  } catch (error) {
    console.error('Error connecting to ActiveMQ:', error);
  }
}

connectToActiveMQ();

export default app; 