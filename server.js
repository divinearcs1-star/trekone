const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const path = require('path');
const api = require('./routes/api')

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

app.use(bodyParser.json());     // used when db data in json format

app.use('/api', api);

app.listen(port, function() {
    console.log("server running on port " + port)});

app.get('/', (req,res) =>{
    res.send ("server is in running")});
