require('dotenv').config();
const jwt = require('jsonwebtoken')

function verifyToken(req, res, next) {
  try {
    if (!req.headers.authorization) {
      return res.status(401).send('Unauthorized request')
    }
    let token = req.headers.authorization.split(' ')[1]
    if (!token || token === 'null') {
      return res.status(401).send('Invalid Token')
    }
    let payload = jwt.verify(token, process.env.JWT_SECRET)
    if (!payload) {
      return res.status(401).send('Unauthorized request')
    }
    // req.email = payload.email
    req.user = payload;
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Access token expired'
      });
    }
    return res.status(401).json({
      message: 'Token verification failed'
    });
  }
}

module.exports = verifyToken;