
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
      const bookingsCollection = db.collection("bookings")

      app.get('/tutors', async (req, res) => {
        const { createdBy_id, limit } = req.query
        const filter = createdBy_id ? { createdBy_id } : {}
        let cursor = tutorsCollection.find(filter)
        if (limit) {
          const n = parseInt(limit, 10)
          if (!Number.isNaN(n) && n > 0) {
            cursor = cursor.limit(n)
          }
        }
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

      app.put('/tutors/:id', async (req, res) => {
        const id = req.params.id
        const updates = { ...req.body }
        delete updates._id

        const result = await tutorsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updates }
        )

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: 'Tutor not found' })
        }

        res.send({ message: 'Tutor updated' })
      })

      app.delete('/tutors/:id', async (req, res) => {
        const id = req.params.id

        const result = await tutorsCollection.deleteOne({
          _id: new ObjectId(id),
        })

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: 'Tutor not found' })
        }

        res.send({ message: 'Tutor deleted' })
      })

      app.post('/bookings', async (req, res) => {
        const booking = req.body
        const result = await bookingsCollection.insertOne(booking)
        res.status(201).send({ insertedId: result.insertedId })
      })
      app.get('/bookings', async (req, res) => {
        const { user_id } = req.query
        const filter = user_id ? { user_id } : {}
        const bookings = await bookingsCollection.find(filter).toArray()
        res.send(bookings)
      })

      // Update one booking (used when user edits session date)
      app.put('/bookings/:id', async (req, res) => {
        const id = req.params.id
        const updates = { ...req.body }
        delete updates._id

        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updates }
        )

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: 'Booking not found' })
        }

        res.send({ message: 'Booking updated' })
      })

      // Delete one booking
      app.delete('/bookings/:id', async (req, res) => {
        const id = req.params.id

        const result = await bookingsCollection.deleteOne({
          _id: new ObjectId(id),
        })

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: 'Booking not found' })
        }

        res.send({ message: 'Booking deleted' })
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
