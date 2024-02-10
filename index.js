const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const status = require("http-status");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 8000;

app.use(express.json());
app.use(cors());

const userValidationType = (user) => {
  if (user.hasOwnProperty('id'))
    if (typeof user.user_id != "number") return 0;
  if (typeof user.user_name != "string") return 0;
  if (typeof user.balance != "number") return 0;
};

const stationValidationType = (stationInfo) => {
  if (stationInfo.hasOwnProperty('station_id'))
    if (typeof stationInfo.station_id != "number") return 0;
  if (typeof stationInfo.station_name != "string") return 0;
  if (typeof stationInfo.longitude != "number") return 0;
  if (typeof stationInfo.latitude != "number") return 0;
};

const trainValidationType = (trainInfo) => {
  if (trainInfo.hasOwnProperty("train_id"))
    if (typeof trainInfo.train_id != "number") return 0;
  if (typeof trainInfo.train_name != "string") return 0;
  if (typeof trainInfo.capacity != "number") return 0;
  for (let i = 0; i < trainInfo.stops.length; i++) {
    if (i == 0) {
      if (typeof trainInfo.stops[0].arrival_time != null) return 0;
      if (typeof trainInfo.stops[0].departure_time != "string") return 0;
    } else if (i == trainInfo.stops.length - 1) {
      if (typeof trainInfo.stops[trainInfo.stops.length - 1].arrival_time != "string") return 0;
      if (typeof trainInfo.stops[trainInfo.stops.length - 1].departure_time != null)
        return 0;
    } else {
      if (typeof trainInfo.stops[i].arrival_time != "string") return 0;
      if (typeof trainInfo.stops[i].departure_time != "string") return 0;
    }
    if (typeof trainInfo.stops[i].station_id != "number") return 0;
    if (typeof trainInfo.stops[i].fare != "number") return 0;
  }
};
const walletValidationType = (amount) => {
  if (typeof amount.recharge != "number") return 0;
}

const uri =
  `mongodb+srv://${process.env.db_user}:${process.env.db_pass}@cluster0.nhg2oh1.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection


    const userCollection = client.db('student_information').collection('user');
    const trainCollection = client.db('student_information').collection('train');
    const stationCollection = client.db('student_information').collection('station');
    const ticketCollection = client.db("student_information").collection("ticket");

    const isWalletExist = async (id) => {
      const exist = await userCollection.findOne({ user_id: id });
      if (exist) return 1;
      else return 0;
    }

    const isStationExist = async (id) => {
      let result = await trainCollection.find().toArray();
      for (let i = 0; i < result.length; i++) {
        let lent = result[i].stops.length;
        for (let j = 0; j < lent; j++) {
          if (result[i].stops[j].station_id == id) {
            return true;
          }
        }
      }
    }

    // Api for user  {Completed}
    app.post('/api/users', async (req, res) => {
      try {
        const user = req.body;
        const validation = userValidationType(user);
        if (validation != 0) {
          const addUserIntoDB = await userCollection.insertOne(user);
          delete user._id;
          if (addUserIntoDB.insertedId) {
            res.status(status.CREATED).send(user);
          }

        } else {
          res.status(status.UNPROCESSABLE_ENTITY).json({
            statusCode: status.UNPROCESSABLE_ENTITY,
            message: "provide correct validated data",
          });
        }
      } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    //Api for station {completed}
    app.post('/api/stations', async (req, res) => {
      try {
        const station = req.body;
        const validation = stationValidationType(station);
        if (validation != 0) {
          const addStationIntoDB = await stationCollection.insertOne(station);
          delete station._id;
          if (addStationIntoDB.insertedId) {
            res.status(status.CREATED).send(station);
          }
        } else {
          res.status(status.UNPROCESSABLE_ENTITY).json({
            statusCode: status.UNPROCESSABLE_ENTITY,
            message: "provide correct validated data",
          });
        }
      } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Api for train {completed}
    app.post('/api/trains', async (req, res) => {
      let train = req.body;
      const addTrainIntoDB = await trainCollection.insertOne(train);
      delete train._id;
      res.status(status.CREATED).json({
        "train_id": parseInt(train.train_id),
        "train_name": `${train.train_name}`,
        "capacity": parseInt(train.capacity),
        "service_start": `${train.stops[0]?.departure_time}`,
        "service_ends": `${train.stops[train.stops.length - 1]?.arrival_time}`,
        "num_stations": parseInt(train.stops.length)
      });
    });

    // get all stations {completed}
    app.get('/api/stations', async (req, res) => {
      const getAllStationsFromDB = await stationCollection.find().toArray();
      getAllStationsFromDB.map((station) => delete station._id);
      res.json({
        stations: getAllStationsFromDB,
      });
    });

    // Train with station id dynamic {completed}
    app.get('/api/stations/:id/trains', async (req, res) => {
      let id = req.params.id;
      let exist = await isStationExist(id);
      if (exist) {
        let trains = [];
        let result = await trainCollection.find().toArray();
        for (let i = 0; i < result.length; i++) {
          let lent = result[i].stops.length;
          for (let j = 0; j < lent; j++) {
            if (result[i].stops[j].station_id == id) {
              trains.push({
                "train_id": result[i].train_id,
                "arrival_time": result[i]?.stops[j]?.arrival_time,
                "departure_time": result[i]?.stops[j]?.departure_time,
              })
            }
          }
        };
        trains.sort((a, b) => {
          // Sort by departure_time
          const departureTimeComparison = compareTimes(
            a.departure_time,
            b.departure_time
          );
          if (departureTimeComparison !== 0) {
            return departureTimeComparison;
          }

          // Sort by arrival_time if departure_time is the same
          const arrivalTimeComparison = compareTimes(
            a.arrival_time,
            b.arrival_time
          );
          if (arrivalTimeComparison !== 0) {
            return arrivalTimeComparison;
          }

          // Sort by train_id if both times are the same
          return a.train_id - b.train_id;
        });

        function compareTimes(timeA, timeB) {
          if (timeA === null && timeB === null) {
            return 0;
          } else if (timeA === null) {
            return -1;
          } else if (timeB === null) {
            return 1;
          } else {
            return timeA.localeCompare(timeB);
          }
        }
        res.status(status.OK).json({
          "station_id": parseInt(id),
          "trains": trains
        })
      } else {
        res.status(status.NOT_FOUND).json({
          message: `station with id: ${id} was not found`
        });
      };
    });

    //Api for wallet id {completed}
    app.get("/api/wallets/:id", async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const exist = await isWalletExist(parseInt(id));
        if (exist) {
          const getSingleUserFromDB = await userCollection.findOne({
            user_id: id,
          });
          if (getSingleUserFromDB._id) {
            delete getSingleUserFromDB._id;
            res.json({
              wallet_id: getSingleUserFromDB.user_id,
              balance: getSingleUserFromDB.balance,
              wallet_user: {
                user_id: getSingleUserFromDB.user_id,
                user_name: getSingleUserFromDB.user_name,
              },
            });
          }
        } else {
          res.status(400).json({
            message: `wallet with id ${id} was not found`,
          });
        }
      } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    //Add wallete balace {completed}
    app.put('/api/wallets/:id', async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const rechargeAmount = req.body;
        const validation = walletValidationType(rechargeAmount);
        if (validation != 0) {
          if (rechargeAmount.recharge < 100 || rechargeAmount.recharge > 1000) {
            return res.status(status.BAD_REQUEST).json({
              message: `invalid amount: ${rechargeAmount.recharge}`,
            });
          }
          const exist = await isWalletExist(parseInt(id));
          if (!exist) {
            res.status(400).json({
              message: `wallet with id: ${id} was not found`,
            });
          } else {
            const query = { user_id: id };
            const userInfo = await userCollection.findOne({ user_id: id });
            const updatedDoc = {
              $set: {
                balance: userInfo.balance + rechargeAmount.recharge
              }
            }
            const updatedBookIntoDB = await userCollection.updateOne(query, updatedDoc);
            if (updatedBookIntoDB.matchedCount > 0) {
              res.json({
                wallet_id: userInfo.user_id,
                balance: userInfo.balance + rechargeAmount.recharge,
                wallet_user: {
                  user_id: userInfo.user_id,
                  user_name: userInfo.user_name,
                },
              });
            }
          }
        } else {
          res.status(status.UNPROCESSABLE_ENTITY).json({
            statusCode: status.UNPROCESSABLE_ENTITY,
            message: "provide correct validated data",
          });
        }
      } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    //Api for purshing ticket {may be completed}
    app.post('/api/tickets', async (req, res) => {
      const info = req.body;
      let { wallet_id, time_after, station_from, station_to } = info;
      const user = await userCollection.findOne({ user_id: wallet_id })
      let getAllTrains = await trainCollection.find().toArray();
      let findTrain = [];
      let cost = 0;
      for (let i = 0; i < getAllTrains.length; i++) {
        for (let j = 0; j < getAllTrains[i].stops.length; j++) {
          let time1 = time_after;
          let time2 = getAllTrains[i].stops[j].arrival_time;

          let result = time1.localeCompare(time2);

          if (
            result <= 0 &&
            getAllTrains[i].stops[j].station_id == station_from
          ) {
            cost += parseInt(getAllTrains[i].stops[j].fare);
            findTrain.push({
              station_id: parseInt(getAllTrains[i].stops[j].station_id),
              train_id: parseInt(getAllTrains[i].train_id),
              arrival_time: getAllTrains[i].stops[j].arrival_time,
              departure_time: getAllTrains[i].stops[j].departure_time,
              fare: parseInt(getAllTrains[i].stops[j].fare),
            });
          }
          if (result <= 0 &&
            getAllTrains[i].stops[j].station_id == station_to) {
            cost += parseInt(getAllTrains[i].stops[j].fare);
            findTrain.push({
              station_id: parseInt(getAllTrains[i].stops[j].station_id),
              train_id: parseInt(getAllTrains[i].train_id),
              arrival_time: getAllTrains[i].stops[j].arrival_time,
              departure_time: getAllTrains[i].stops[j].departure_time,
              fare: parseInt(getAllTrains[i].stops[j].fare),
            });
          }
        }
      }
      if (user.balance < cost) {
        return res
          .status(402)
          .json({ message: `recharge amount: ${user.balance} to purchase the ticket` });
      }
      const lastId = await (await ticketCollection.find().toArray()).reverse();
      let lastIdInfo = parseInt(lastId[lastId.length - 1].ticket_id);
      console.log(lastId);
      const result = await ticketCollection.insertOne({
        ticket_id: lastIdInfo + 1,
        balance: user.balance,
        wallet_id: user.user_id,
        stations: findTrain,
      });
      res.status(status.CREATED).send({
        ticket_id: lastIdInfo + 1,
        balance: user.balance,
        wallet_id: user.user_id,
        stations: findTrain,
      });

    })


    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
  res.send("Prili server is running");
});

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});