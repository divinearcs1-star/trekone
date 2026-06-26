const jwt = require('jsonwebtoken');

function verifyAdmin(req, res, next) {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );
    if (decoded.role !== "admin") {
      return res.status(403).json({
        message: "Access denied"
      });
    }
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      message: "Unauthorized"
    });
  }
}

module.exports = verifyAdmin;