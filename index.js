const express = require("express")
const { PrismaClient } = require("@prisma/client")
const { google } = require("googleapis")
const app = express()
const client = new PrismaClient()

const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID, 
  process.env.SECRET_ID, 
  process.env.REDIRECT
);

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
        where: { email: "support@exceleed.in" },
      });
  
      const oAuth2Client = await getOAuth2Client(String(user?.email));
      const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  

      const rooms = await client.room.findMany({
        where: {
          userId: user?.id
        }
      })

      for (const room of rooms) {
        try {
          // Fetch events for the room's calendar
          const events = await calendar.events.list({
            calendarId: room.resourceEmail, // Use the room's calendar ID
            timeMin: new Date().toISOString(), // Fetch events starting from now
            maxResults: 10, // Limit the number of results
            singleEvents: true,
            orderBy: "startTime",
          });

          console.log(`Events for room ${room.roomName}:`, events.data.items);

        } catch (error) {
          console.log(error)
        }
      }
      
        
  
        // console.log("Data",event.data)
        console.log("Token",verificationToken)
  
        // const meetingData = {
        //   meetingId: event.data.id, // Google Calendar event ID
        //   title: event.data.summary, // Event title
        //   startTime: new Date(event.data.start.dateTime), // Event start time
        //   endTime: new Date(event.data.end.dateTime ), // Event end time
        //   status: event.data.status || 'confirmed', // Event status
        //   meetingLink: event.data.hangoutLink || '', // Google Meet link (if available)
        //   roomId: 1, // Replace with dynamic room ID (e.g., based on event location or description)
        //   userId: user?.id, // Associate with the user
        // };
  
        // await client.meetings.upsert({
        //   where: { meetingId: String(event.data.id) },
        //   update: meetingData,
        //   create: meetingData,
        // });
    }
  
    res.status(200).end(); // Acknowledge receipt
  });

app.listen(8000, ()=>{
    console.log("Server started at port 8000")
})