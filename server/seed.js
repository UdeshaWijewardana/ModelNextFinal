require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Booking = require('./models/Booking');

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log(err));

const seedData = async () => {
    try {
        await User.deleteMany({});
        await Booking.deleteMany({});

        // 1. HARDCODED IDs (So they never change)
        const MODEL_ID = "65ca10000000000000000001";
        const CLIENT_ID = "65ca10000000000000000002";

        // 2. Create Model
        await User.create({
            _id: MODEL_ID, // <--- FORCED ID
            name: "Isabella Rossi",
            email: "isabella@modelnext.com",
            role: "model",
            isVerified: true,
            profileImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
            stats: { height: "5' 9\"", waist: "24\"", shoes: "39 EU", profileCompletion: 75 }
        });

        // 3. Create Client
        await User.create({
            _id: CLIENT_ID, // <--- FORCED ID
            name: "Vogue Agency",
            email: "contact@vogue.com",
            role: "client",
            isVerified: true,
            profileImage: "https://images.unsplash.com/photo-1554048612-387768052bf7?auto=format&fit=crop&w=300&q=80",
            stats: {}
        });

        // 4. Create Initial Events
        await Booking.create({
            clientName: "Vogue Agency",
            jobType: "Open Casting Call",
            date: "Oct 25, 2024",
            modelId: null, // Public Event
            status: "NEW",
            isEvent: true
        });

        console.log("✅ Data Seeded with FIXED IDs.");
        console.log("--------------------------------------");
        console.log("MODEL ID: ", MODEL_ID);
        console.log("CLIENT ID:", CLIENT_ID);
        console.log("--------------------------------------");
        
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedData();