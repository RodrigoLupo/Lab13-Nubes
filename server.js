require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb'); // Agrega DeleteCommand
const { v4: uuidv4 } = require('uuid');
const app = express();
const PORT = 3000;

// Configuración de DynamoDB con AWS SDK v3
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// Función para verificar y crear la tabla si no existe
async function checkAndCreateTable() {
  try {
    // Verificar si la tabla existe
    await client.send(new DescribeTableCommand({ TableName: 'Tasks' }));
    console.log("La tabla 'Tasks' ya existe.");
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      // Si la tabla no existe, la creamos
      console.log("La tabla 'Tasks' no existe. Creando la tabla...");
      await client.send(new CreateTableCommand({
        TableName: 'Tasks',
        KeySchema: [{ AttributeName: 'task_id', KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: 'task_id', AttributeType: 'S' }],
        ProvisionedThroughput: {
          ReadCapacityUnits: 1,
          WriteCapacityUnits: 1,
        },
      }));
      console.log("Tabla 'Tasks' creada exitosamente.");
    } else {
      console.error("Error al verificar o crear la tabla:", err);
    }
  }
}

// Llamar a la función de verificación y creación de tabla
checkAndCreateTable();

// Ruta principal: listar todas las tareas
app.get('/', async (req, res) => {
  try {
    const data = await docClient.send(new ScanCommand({ TableName: 'Tasks' }));
    res.render('index', { tasks: data.Items });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al cargar las tareas");
  }
});
app.get('/create', (req, res) => {
    res.render('create');
});
// Crear tarea
app.post('/create', async (req, res) => {
  const { taskName, assignedTo, startDate, endDate, status } = req.body;
  const task_id = uuidv4(); // Generar un UUID único para cada tarea
  try {
    await docClient.send(new PutCommand({
      TableName: 'Tasks',
      Item: { task_id, taskName, assignedTo, startDate, endDate, status }
    }));
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al crear la tarea");
  }
});

// Obtener la tarea para editar
app.get('/edit/:task_id', async (req, res) => {
    const { task_id } = req.params;
    try {
      const data = await docClient.send(new GetCommand({
        TableName: 'Tasks',
        Key: { task_id }
      }));
      res.render('update', { task: data.Item });
    } catch (err) {
      console.error(err);
      res.status(500).send("Error al obtener la tarea");
    }
  });
  
  // Actualizar tarea
  app.post('/update/:task_id', async (req, res) => {
    const { task_id } = req.params;
    const { assignedTo, startDate, endDate, status } = req.body;
    try {
      await docClient.send(new UpdateCommand({
        TableName: 'Tasks',
        Key: { task_id },
        UpdateExpression: 'set assignedTo = :a, startDate = :s, endDate = :e, #status = :st',
        ExpressionAttributeNames: {
            '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':a': assignedTo,
          ':s': startDate,
          ':e': endDate,
          ':st': status
        }
      }));
      res.redirect('/');
    } catch (err) {
      console.error(err);
      res.status(500).send("Error al actualizar la tarea");
    }
  });
  

// Cargar la tarea para eliminar
app.get('/delete/:task_id', async (req, res) => {
    const { task_id } = req.params;
    try {
      const data = await docClient.send(new GetCommand({
        TableName: 'Tasks',
        Key: { task_id }
      }));
      res.render('delete', { task: data.Item });
    } catch (err) {
      console.error(err);
      res.status(500).send("Error al cargar la tarea para eliminar");
    }
  });
  
  // Ruta para eliminar la tarea
  app.post('/delete/:task_id', async (req, res) => {
    const { task_id } = req.params;
    try {
      await docClient.send(new DeleteCommand({
        TableName: 'Tasks',
        Key: { task_id }
      }));
      res.redirect('/');
    } catch (err) {
      console.error(err);
      res.status(500).send("Error al eliminar la tarea");
    }
  });
  

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
