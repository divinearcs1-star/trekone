const express = require('express')
const mongoose = require('mongoose');  // MongoDB library
const cors = require('cors')
const path = require('path');
const apiRoute = require('./routes/api')
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payment');
const bookingRoutes = require('./routes/booking');
const trekRoutes = require('./routes/trek');

const app = express();
const port = process.env.PORT || '3000';

app.use(cors());

// app.use((req, res, next) => {
//     res.header("Access-Control-Allow-Origin",
//      //    "http://localhost:4200");
//          "http://trekone.s3-website.ap-south-1.amazonaws.com");
//     next();
// });

app.use(cors({
    origin: [
        "https://trekone.netlify.app",
        "http://trekone.s3-website.ap-south-1.amazonaws.com"
    ]
}));

app.use(express.static(path.join(__dirname, 'dist')));

app.use('/api/razorpay/webhook', express.raw({ type: 'application/json' }));
//app.use(bodyParser.json());     // used when db data in json format
app.use(express.json());

app.use((err, req, res, next) => {
    console.error("Global Error:", err.message);
    res.status(400).json({ error: err.message });
});
app.use('/api', apiRoute);
app.use('/auth', authRoutes);
app.use('/payment', paymentRoutes);
app.use('/booking', bookingRoutes);
app.use('/trek', trekRoutes);

app.listen(port, function () {
    console.log("server running on port " + port)
});

app.get('/', (req, res) => {
    res.send("server is in running")
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.log(err));
