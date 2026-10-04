require('dotenv').config();
const mongoose = require('mongoose');

const Agency = require('./models/Agency');
const Client = require('./models/Client');
const ModelUser = require('./models/ModelUser');
const Photographer = require('./models/Photographer');

async function checkDb() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB. Checking collections...");

  const agencies = await Agency.find({});
  console.log("Agencies:", agencies.map(a => a.email));

  const clients = await Client.find({});
  console.log("Clients:", clients.map(c => c.email));

  const models = await ModelUser.find({});
  console.log("Models:", models.map(m => m.email));

  const photographers = await Photographer.find({});
  console.log("Photographers:", photographers.map(p => p.email));

  process.exit(0);
}

checkDb().catch(console.error);
