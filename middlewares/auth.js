require('dotenv').config();
const jwt = require('jsonwebtoken')
const User = require('../models/user');

const verifyToken = async  (req, res, next) => {
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
    const user = await User.findOne({
      email: payload.email
    });

    if (!user || user.status === 'blocked') {
      return res.status(403).send('Account blocked');
    }
    req.user = payload;
    // req.email = payload.email;
    // req.role = payload.role;
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