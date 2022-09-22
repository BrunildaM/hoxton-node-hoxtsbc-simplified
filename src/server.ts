import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv'
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
dotenv.config()
const app = express();
app.use(cors());
app.use(express.json());

const port = 5000;


const SECRET= process.env.SECRET!


// function getToken (id: number) {
//   return jwt.sign({ id: id }, SECRET, {
//     expiresIn: '5 minutes'
//   })
// }

// Getting transactions together with the user
app.get("/users", async (req, res) => {
  const users = await prisma.user.findMany()
  res.send(users);
});



//when should a signup fail needs to be added
app.post("/sign-up", async (req, res) => {
  const user = await prisma.user.create({
    data: {
      email: req.body.email,
      password: bcrypt.hashSync(req.body.password),
    },
  });
  res.send(user);
});


app.post("/sign-in", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { email: req.body.email },
  });
  if (user && bcrypt.compareSync(req.body.password, user.password)) {
    res.send({ message: "Welcome to your account" });
  } else {
    res
      .status(400)
      .send({ error: "Please make sure you are using the right credentials!" });
  }
});

app.listen(port, () => {
  console.log(`Click: http://localhost:${port}`);
});
