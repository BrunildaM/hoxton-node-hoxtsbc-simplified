import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const port = 5000;

const SECRET = process.env.SECRET!;

function hash(password: string) {
  return bcrypt.hashSync(password, 6);
}

function verify(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}

function generateToken(id: number) {
  return jwt.sign({ id }, SECRET);
}

async function getCurrentUser(token = '') {
  try {
    const data = jwt.verify(token, SECRET);
    const user = await prisma.user.findUnique({
      where: { id: (data as any).id },
      include: {
        recievedTransaction: { include: { sender: true } },
        sentTransactions: { include: { recipient: true } },
      },
    });
    return user;
  } catch (error) {
    //@ts-ignore
    return null;
  }
}

// Getting transactions together with the user
app.get("/users", async (req, res) => {
  const users = await prisma.user.findMany();
  res.send(users);
});

app.get("/transactions", async (req, res) => {
  try {
    const token = req.headers.authorization;

    if (!token) {
      res.status(401).send({ errors: ["No token provided."] });
      return;
    }

    const user = await getCurrentUser(token);
    if (!user) {
      res.status(401).send({ errors: ["Invalid token provided."] });
      return;
    }

    res.send({
      sentTransactions: user.sentTransactions,
      receivedTransactions: user.recievedTransaction,
    });
  } catch (error) {
    // @ts-ignore
    res.status(400).send({ errors: [error.message] });
  }
});

app.post("/transactions", async (req, res) => {
  const token = req.headers.authorization

  if(!token) {
    res.status(401).send({ errors: ["No token provided!"]})
    return
  }

  const user = await getCurrentUser(token)

  if(!user) {
    res.status(401).send({ errors: ["Invalid token provided!"] })
    return
  }

 
  const data = {
    ammount: req.body.ammount,
    recipientId: req.body.recipientId,
    senderId: user.id
  }

  const errors: string[] = []

  if(typeof data.ammount !== "number") {
    errors.push("Ammount is missing or not a number!")
  }

  if(data.ammount < 1) {
    errors.push("You can't send less than 1$!")
  }

  if(data.recipientId === data.senderId) {
    errors.push("You can't send money to your own account!")
  }

  if(typeof data.recipientId !== "number") {
    errors.push("Recipient id is missing or not a number!")
  }

  if (data.ammount > user.balance) {
    errors.push("You don't have enough money for this transaction.")
  }

  const recipient = await prisma.user.findUnique({
    where: { id: data.recipientId }
  })
  if (!recipient) {
    errors.push('Recipient does not exist.')
  }

  if (errors.length > 0) {
    res.status(400).send({ errors })
    return
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { balance: user.balance - data.ammount }
  })

  await prisma.user.update({
    where: { id: data.recipientId },
    data: { balance: recipient!.balance + data.ammount }
  })

  const transaction = await prisma.transaction.create({
    data,
    include: { recipient: { select: { id: true, email: true } } }
  })

  res.send(transaction)


});

//Don't create two different accounts with the same email
app.post("/sign-up", async (req, res) => {
  const { email, password } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    const errors: string[] = [];

    if (typeof email !== "string") {
      errors.push("Email not provided or not a string");
    }

    if (typeof password !== "string") {
      errors.push("Password not provided or not a string");
    }

    if (errors.length > 0) {
      res.status(400).send({ errors });
      return;
    }

    if (existingUser) {
      return res.status(400).send({ errors: ["Email already exist!"] });
    }
    const user = await prisma.user.create({
      data: { email, password: hash(password) },
    });
    const token = generateToken(user.id);
    res.send({ user, token });
  } catch (error) {
    //@ts-ignore
    res.status(400).send({ errors: [error.message] });
  }
});

app.post("/sign-in", async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;

    const errors: string[] = [];

    if (typeof email !== "string") {
      errors.push("Email not provided or not a string");
    }

    if (typeof password !== "string") {
      errors.push("Password not provided or not a string");
    }

    if (errors.length > 0) {
      res.status(400).send({ errors });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (user && verify(password, user.password)) {
      const token = generateToken(user.id);
      res.send({ user, token });
    } else {
      res.status(400).send({
        errors: ["Please make sure you are using the right credentials!"],
      });
    }
  } catch (error) {
    //@ts-ignore
    res.status(400).send({ errors: [error.message] });
  }
});

app.get("/validate", async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (token) {
      const user = await getCurrentUser(token);
      if (user) {
        const newToken = generateToken(user.id);
        res.send({ user, token: newToken });
      } else {
        res.status(400).send({ errors: ["Token is invalid!"] });
      }
    } else {
      res.status(400).send({ errors: ["Token not provided!"] });
    }
  } catch (error) {
    //@ts-ignore
    res.status(400).send({ errors: [error.message] });
  }
});

app.listen(port, () => {
  console.log(`Click: http://localhost:${port}`);
});
