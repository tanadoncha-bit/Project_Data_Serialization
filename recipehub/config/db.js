const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB Connection Error:', error.message);
    // Keep the server available; recipe routes return 503 until MongoDB is connected.
    return false;
  }
};

module.exports = connectDB;
