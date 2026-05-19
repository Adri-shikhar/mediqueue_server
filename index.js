
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

      async function useOneSlot(tutorIdString) {
        const tutorObjectId = new ObjectId(tutorIdString)


        //Booking logic
        const updatedTutor = await tutorsCollection.findOneAndUpdate(
          { _id: tutorObjectId, totalSlot: { $gt: 0 } },
          { $inc: { totalSlot: -1 } },
          { returnDocument: 'after' }
        )

        return updatedTutor
      }

      
      async function returnOneSlot(tutorIdString) {
        const tutorObjectId = new ObjectId(tutorIdString)

        await tutorsCollection.updateOne(
          { _id: tutorObjectId },
          { $inc: { totalSlot: 1 } }
        )
      }

      function escapeRegex(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      }

      app.get('/tutors', async (req, res) => {
        const {
          createdBy_id,
          limit,
          name,
          registrationStart,
          registrationEnd,
        } = req.query

        const filter = {}

        if (createdBy_id) {
          filter.createdBy_id = createdBy_id
        }

        // Case-insensitive search by tutor name ($regex)
        if (name && String(name).trim()) {
          filter.tutorName = {
            $regex: escapeRegex(String(name).trim()),
            $options: 'i',
          }
        }

        // Filter by registration date (createdAt) using $gte / $lte
        if (registrationStart || registrationEnd) {
          filter.createdAt = {}

          if (registrationStart) {
            const start = new Date(`${registrationStart}T00:00:00.000Z`)
            if (!Number.isNaN(start.getTime())) {
              filter.createdAt.$gte = start.toISOString()
            }
          }

          if (registrationEnd) {
            const end = new Date(`${registrationEnd}T23:59:59.999Z`)
            if (!Number.isNaN(end.getTime())) {
              filter.createdAt.$lte = end.toISOString()
            }
          }

          if (Object.keys(filter.createdAt).length === 0) {
            delete filter.createdAt
          }
        }

        let cursor = tutorsCollection.find(filter).sort({ createdAt: -1 })

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

      // CREATE BOOKING — uses 1 slot
      app.post('/bookings', async (req, res) => {
        const booking = req.body
        const tutorId = booking.tutorId

        if (!tutorId) {
          return res.status(400).send({ message: 'Tutor ID is required' })
        }

        let tutorAfterBooking = null

        try {
          tutorAfterBooking = await useOneSlot(tutorId)
        } catch (error) {
          return res.status(400).send({ message: 'Invalid tutor ID' })
        }

        // useOneSlot returns null when totalSlot is 0 (fully booked)
        if (!tutorAfterBooking) {
          return res.status(400).send({ message: 'No slots available' })
        }

        const result = await bookingsCollection.insertOne(booking)

        res.status(201).send({
          insertedId: result.insertedId,
          remainingSlots: tutorAfterBooking.totalSlot,
        })
      })
      app.get('/bookings', async (req, res) => {
        const { user_id } = req.query
        const filter = user_id ? { user_id } : {}
        const bookings = await bookingsCollection.find(filter).toArray()
        res.send(bookings)
      })

      // UPDATE BOOKING — if status becomes cancelled, return 1 slot
      app.put('/bookings/:id', async (req, res) => {
        const id = req.params.id
        const updates = { ...req.body }
        delete updates._id

        const oldBooking = await bookingsCollection.findOne({
          _id: new ObjectId(id),
        })

        if (!oldBooking) {
          return res.status(404).send({ message: 'Booking not found' })
        }

        const oldStatus = (oldBooking.status || 'Confirmed').toLowerCase()
        const newStatus = (updates.status || oldBooking.status || 'Confirmed').toLowerCase()

        const wasConfirmed = oldStatus !== 'cancelled'
        const nowCancelled = newStatus === 'cancelled'

        // CANCEL: give slot back (+1)
        if (wasConfirmed && nowCancelled && oldBooking.tutorId) {
          await returnOneSlot(oldBooking.tutorId)
        }

        await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updates }
        )

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
