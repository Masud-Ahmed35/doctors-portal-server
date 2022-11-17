const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 7007;

const app = express();

// --------Middle-Ware---------
app.use(cors());
app.use(express.json());

// -------------Database Connection--------------
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.vvll70g.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function dbConnect() {
    try {
        await client.connect();
        console.log('Database is Connected');

    } catch (error) {
        console.log(error.name, error.message);
    }
}
dbConnect();

// ------------Collections----------
const appointmentCollection = client.db('doctorsPortal').collection('appointmentOptions');
const bookingCollection = client.db('doctorsPortal').collection('bookings');

// ------------End Points------------

// ---------Root End-Points-----------
app.get('/', (req, res) => {
    try {
        res.send({
            success: true,
            message: 'Doctors Server is Running.....'
        })
    } catch (error) {
        res.send({
            success: false,
            error: error.message
        })
    }
})
// -----------------------------------------------

app.get('/appointmentOptions', async (req, res) => {
    try {
        const date = req.query.date;
        const query = {};
        const options = await appointmentCollection.find(query).toArray();

        const bookingQuery = { appointmentDate: date }
        const alreadyBooked = await bookingCollection.find(bookingQuery).toArray();
        options.forEach(option => {
            const optionBooked = alreadyBooked.filter(book => book.treatment === option.name)
            const bookedSlots = optionBooked.map(book => book.slot)
            const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
            option.slots = remainingSlots;
        })
        res.send(options);

        // if (data) {
        //     res.send({
        //         success: true,
        //         message: 'Get the Data Successfully',
        //         data: data
        //     })
        // }
        // else {
        //     res.send({
        //         success: false,
        //         error: 'Data did not found.'
        //     })
        // }

    } catch (error) {
        res.send({
            success: false,
            error: error.message
        })
    }
})

app.get('/v2/appointmentOptions', async (req, res) => {
    try {
        const date = req.query.date;
        const options = await appointmentCollection.aggregate([
            {
                $lookup: {
                    from: 'bookings',
                    localField: 'name',
                    foreignField: 'treatment',
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ['$appointmentDate', date]
                                }
                            }
                        }
                    ],
                    as: 'booked'
                }
            },
            {
                $project: {
                    name: 1,
                    slots: 1,
                    booked: {
                        $map: {
                            input: '$booked',
                            as: 'book',
                            in: '$$book.slot'
                        }
                    }
                }
            },
            {
                $project: {
                    name: 1,
                    slots: {
                        $setDifference: ['$slots', '$booked']
                    }
                }
            }
        ]).toArray();
        res.send(options);

    } catch (error) {
        res.send({
            success: false,
            error: error.message
        })
    }
})

app.post('/bookings', async (req, res) => {
    try {
        const booking = req.body;
        const query = {
            appointmentDate: booking.appointmentDate,
            treatment: booking.treatment,
            email: booking.email
        }

        const alreadyBooked = await bookingCollection.find(query).toArray();
        if (alreadyBooked.length) {
            const message = `You already have a booking on ${booking.appointmentDate}`
            return res.send({ acknowledged: false, message })
        }

        const data = await bookingCollection.insertOne(booking);
        res.send(data);

    } catch (error) {
        res.send({
            success: false,
            error: error.message
        })
    }
})

// -------------Server Running-------------
app.listen(port, () => {
    console.log(`Server is Running on Port: ${port}`);
})