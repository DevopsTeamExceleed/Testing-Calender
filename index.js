const express = require("express")
const { PrismaClient } = require("@prisma/client")
const { google } = require("googleapis")
const app = express()
const client = new PrismaClient()

// const oAuth2Client = new google.auth.OAuth2(
//   process.env.CLIENT_ID, 
//   process.env.SECRET_ID, 
//   process.env.REDIRECT
// );

const getOAuth2Client = async (email) => {
  const user = await client.user.findUnique({
    where: { email },
  });

  if (!user) throw new Error("User not found");

  const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID, 
    process.env.SECRET_ID, 
  );

  oauth2Client.setCredentials({
    refresh_token: user?.refreshToken,
    access_token: user?.accessToken,
    expiry_date: user?.expiryDate,
  });

  return oauth2Client;
};

app.get("/", async(req, res)=>{
    const user = await client.user.findFirst({
        where: {
            id: 1
        }
    })
    console.log("Hello world")
    res.send({
        message: "This a dummy server", user
    })
})

// app.post("/webhook", async (req, res) => {
//     const channelId = req.header("X-Goog-Channel-ID");
//     const resourceId = req.header("X-Goog-Resource-ID");
//     const resourceState = req.header("X-Goog-Resource-State");
  
//     console.log("Notification received:", { channelId, resourceId, resourceState });
  
//     const user = await client.user.findFirst({
//       where: {
//         email: "support@exceleed.in"
//       }
//     })
  
//     if (resourceState === "exists") {
//       try {
//         const calendar = google.calendar("v3");
//         // const oAuth2Client = new google.auth.OAuth2();
//         oAuth2Client.setCredentials({
//           access_token: user?.accessToken,
//           refresh_token: user?.refreshToken,
//         });
  
//         const events = await calendar.events.list({
//           auth: oAuth2Client,
//           calendarId: "primary", // Replace with your calendar ID
//           timeMin: new Date().toISOString(),
//         });
  
//         console.log("Updated events:", events.data.items);
//         // Sync with your database
//       } catch (err) {
//         console.error("Error fetching updated events:", err);
//       }
//     }
  
//     res.status(200).end(); // Acknowledge receipt
//   });

  app.post("/webhook", async (req, res) => {
    const channelId = req.header("X-Goog-Channel-ID");
    const resourceId = req.header("X-Goog-Resource-ID");
    const resourceState = req.header("X-Goog-Resource-State");
    const verificationToken = req.headers['x-goog-channel-token']
  
    console.log("Notification received:", { channelId, resourceId, resourceState });

    if(resourceState === "sync"){
      console.log("Channel is active")
    }
  
    if (resourceState === "exists") {
      const user = await client.user.findUnique({
        where: { email: verificationToken },
      });
  
      const oAuth2Client = await getOAuth2Client(String(user?.email));
      const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  
      const roomMail = await client.watch.findFirst({
        where: {
          resourceId: resourceId
        }
      })

      console.log(roomMail)

        try {
          // Fetch events for the room's calendar
          const events = await calendar.events.list({
            calendarId: roomMail.chanelId, // Use the room's calendar ID
            timeMin: new Date().toISOString(), // Fetch events starting from now
            maxResults: 10, // Limit the number of results
            singleEvents: true,
            orderBy: "startTime",
          });

          console.log(`Events for room ${room.roomName}:`, events.data.items);

          for (const event of events.data.items) {
            const meetingData = {
              meetingId: event.id, // Google Calendar event ID
              title: event.summary, // Event title
              startTime: new Date(event.start.dateTime || event.start.date), // Event start time
              endTime: new Date(event.end.dateTime || event.end.date), // Event end time
              status: event.status || "confirmed", // Event status
              meetingLink: event.hangoutLink || "", // Google Meet link (if available)
              roomId: room.id, // Associate with the room
              userId: user.id, // Associate with the user
            };

            await client.meetings.upsert({
              where: { meetingId: event.id },
              update: meetingData,
              create: meetingData,
            });

            console.log(`Meeting synced for room ${room.roomName}:`, event.summary);
          }
        } catch (error) {
          console.log(error)
        }
      
      
        // console.log("Data",event.data)
        console.log("Token",verificationToken)
    }
  
    res.status(200).end(); // Acknowledge receipt
  });

app.listen(8000, ()=>{
    console.log("Server started at port 8000")
})