import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import User from "./schema/User";
import { nanoid } from "nanoid";
import jwt from "jsonwebtoken";

dotenv.config();

const server = express();
const PORT = process.env.PORT || 3500;

let emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/; // regex for email
let passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/; // regex for password

server.use(express.json());

mongoose.connect(process.env.DB_LOCATION, {
    autoIndex: true,
});

const generateUsername = async (email) => {
    const username = email.split("@")[0];
    const isUsernameTaken = await User.findOne({ "personal_info.username": username });

    if (isUsernameTaken) {
        username += nanoid(5);
    }
    return username;
}

const formatDataToSend = (user) => {
    const accessToken = jwt.sign({ id: user._id }, process.env.SECRET_ACCESS_KEY);

    return {
        profile_img: user.personal_info.profile_img,
        fullname: user.personal_info.fullname,
        username: user.personal_info.username,
        access_token: accessToken,
    }
}

server.post("/signup", (req, res) => {
    const { fullname, email, password } = req.body;

    if (!fullname || !email || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    if (fullname.length < 3) {
        return res.status(400).json({ error: "Fullname must be at least 3 characters long" });
    }

    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Email is invalid" });
    }

    if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: "Password should be 6 to 20 characters long and contain at least one uppercase letter, one lowercase letter and one number" });
    }

    bcrypt.hash(password, 10, async (err, hash) => {
        const username = await generateUsername(email);

        const user = new User({
            personal_info: {
                fullname,
                email,
                username,
                password: hash,
            },
        });

        user.save().then((user) => {
            return res.status(200).json(formatDataToSend(user));
        }).catch((err) => {
            if (err.code === 11000) {
                return res.status(400).json({ error: "Email already exists" })
            }
            return res.status(500).json({ error: err.message });
        });
    });
});

server.post("/signin", (req, res) => {
    const { email, password } = req.body;

    User.findOne({ "personal_info.email": email }).then((user) => {
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        bcrypt.compare(password, user.personal_info.password).then((err, result) => {
            if (err) {
                return res.status(400).json({ error: "Error occured while login, please try again" });
            }
            if (!result) {
                return res.status(400).json({ error: "Password is incorrect" });
            }

            return res.status(200).json(formatDataToSend(user));
        });
    }).catch((err) => {
        return res.status(500).json({ error: err.message });
    });
});

server.listen(PORT, () => console.log(`Listening on port -> ${PORT}`));