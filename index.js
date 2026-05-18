
const express = require('express')
const dotenv = require('dotenv')
dotenv.config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb')

const app = express()
const port = process.env.PORT || 8000
const cors = require('cors')
app.use(cors())
app.use(express.json())

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

  async function run() {
    try {
      const db = client.db("Mediqueue")
      const tutorsCollection = db.collection("tutors")

      app.get('/tutors', async (req, res) => {
        const cursor = tutorsCollection.find({})
        const tutors = await cursor.toArray()
        res.send(tutors)
      })
      app.get('/tutors/:id', async (req, res) => {
        const id = req.params.id
        const tutor = await tutorsCollection.findOne({ _id: new ObjectId(id) })
        res.send(tutor)
      })

      app.post('/tutors', async (req, res) => {
        const tutor = req.body
        const result = await tutorsCollection.insertOne(tutor)
        res.status(201).send({ insertedId: result.insertedId })
      })

      
      // Connect the client to the server	(optional starting in v4.7)
      await client.connect();

      // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
     
    }
  }
  run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
