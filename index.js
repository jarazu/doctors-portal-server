const express = require('express')
const cors = require('cors')
const { MongoClient } = require('mongodb');
require('dotenv').config()
const app = express()
const port = process.env.port || 5000

// firebase auth starts ***************************
var admin = require("firebase-admin");

// var serviceAccount = require("./doctors-portal-8e4f6-firebase-adminsdk-j0tga-3792fc418b.json");
var serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
// firebase auth end ****************************************

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.v21cd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next){
  if(req.headers?.authorization?.startsWith('Bearer ')){
    const token = req.headers.authorization.split(' ')[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch (error) {
      
    }
  }
  next();
}

async function run(){
    try{
        await client.connect();
        const database = client.db('doctors_portal');
        const appointmentsCollection = database.collection('appointments');
        const usersCollection = database.collection('users');

        app.get('/appointments', async (req, res) => {
          const email = req.query.email;
          const date = req.query.date;
          const query = {email: email, date: date}
          const cursor = appointmentsCollection.find(query);
          const appointments = await cursor.toArray();
          res.json(appointments);
        });

        app.get('/users/:email', async(req, res) =>{
          const email = req.params.email;
          const query = {email};
          const user = await usersCollection.findOne(query);
          let isAdmin = false;
          if (user?.role === 'admin') {
            isAdmin = true;
          }
          res.json({admin: isAdmin});
        })

        app.post('/appointments', verifyToken, async(req, res) => {
          const appointment = req.body;
          const result = await appointmentsCollection.insertOne(appointment);
          res.json(result)
        })
        
        app.post('/users', async(req, res) => {
          const users = req.body;
          const result = await usersCollection.insertOne(users);
          res.json(result)
        })

        app.put('/users', async(req, res) => {
          const users = req.body;
          const filter = {email: users.email}
          const options = {upsert: true}
          const updateDoc = {$set: users};
          const result = await usersCollection.updateOne(filter, updateDoc, options);
          res.json('put response',result);
        })

        app.put('/users/admin', verifyToken, async(req, res) =>{
          const useremail = req.body;
          const requesterEmail = req.decodedEmail;
          if (requesterEmail) {
            const requesterAccount = await usersCollection.findOne({email: requesterEmail});
            if (requesterAccount.role === 'admin') {
              const filter = {email: useremail.email}
              const updateDoc = {$set: {role: 'admin'}}
              const result = await usersCollection.updateOne(filter, updateDoc);
              res.json(result);
            }
          }
          else{
            res.status(401)
          }
        })
      }
    finally{

    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello doctors portal!')
  //
})

app.listen(port, () => {
  console.log(`listening at ${port}`)
})