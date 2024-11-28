import express from 'express';
import h3 from 'h3-js';
import { spawn } from 'child_process';

const app = express();
app.use(express.json());
const list = []



app.get('/', (req, res) => {
    res.send(list);
});

app.post('/insert', (req, res) => {
    list.push(req.body);
    res.status(201).send(req.body + ' inserido com sucesso!');
});

app.post('/', (req, res) => {
    const { latOrigin, lngOrigin, latDest, lngDest} = req.body;
    const origin = h3.latLngToCell(latOrigin, lngOrigin, 9);
    const destination = h3.latLngToCell(latDest, lngDest, 9);
    console.log(origin, destination);
    const pythonArgs = ["predict.py", origin, destination];
    const pythonProcess = spawn('python', pythonArgs);

    let pythonOutput = '';
    pythonProcess.stdout.on('data', (data) => {
        pythonOutput += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error('Erro no script Python:', data.toString());
    });
    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            return res.status(500).send({ error: 'Erro ao executar o script Python.' });
        }

        // Enviar o resultado da predição para o cliente
        res.status(200).send({ predictedFare: parseFloat(pythonOutput.trim()) });
    });


    // res.status(201).send(origin + ' ' + destination);

});

export default app; 