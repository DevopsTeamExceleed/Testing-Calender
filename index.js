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

        // for (const event of events.data.items) {
          //   const meetingData = {
          //     meetingId: event.id, // Google Calendar event ID
          //     title: event.summary, // Event title
          //     description: event.description || "",
          //     startTime: new Date(event.start.dateTime || event.start.date), // Event start time
          //     endTime: new Date(event.end.dateTime || event.end.date), // Event end time
          //     status: event.status || "confirmed", // Event status
          //     meetingLink: event.hangoutLink || "", // Google Meet link (if available)
          //     roomMail: roomMail.Room.resourceEmail, // Associate with the room
          //     userEmail: user.email, // Associate with the user
          //   };

          //   await client.meetings.upsert({
          //     where: { meetingId: event.id },
          //     update: meetingData,
          //     create: meetingData,
          //   });

          //   console.log(`Meeting synced for room ${roomMail.Room.roomName}:`, event.summary);
          // }
  
//     res.status(200).end(); // Acknowledge receipt
//   });

  app.post("/webhook", async (req, res) => {
    const channelId = req.header("X-Goog-Channel-ID");
    const resourceId = req.header("X-Goog-Resource-ID");
    const resourceState = req.header("X-Goog-Resource-State");
    const messageNumber = req.header("X-Goog-Message-Number");
    const verificationToken = req.headers['x-goog-channel-token']
  
    console.log("Notification received:", { channelId, resourceId, resourceState, messageNumber });

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
        }, select: {
          Room: true
        }
      })

      console.log(roomMail)

        try {
          // Fetch events for the room's calendar
          const events = await calendar.events.list({
            calendarId: roomMail.Room.resourceEmail, // Use the room's calendar ID
            timeMin: new Date().toISOString(), // Fetch events starting from now
            maxResults: 10, // Limit the number of results
            singleEvents: true,
            orderBy: "startTime",
          });

          console.log(`Events for room ${roomMail.Room.roomName}:`, events.data.items);

          const dbEvents = await client.meetings.findMany({
            where: {
              roomMail: roomMail.Room.resourceEmail
            }
          })

          const calendarIds = new Set(events.data.items.map(event => event.id))

          for(const dbEvent of dbEvents){
            if(!calendarIds.has(dbEvent.meetingId)){
              await client.meetings.delete({
                where: {
                  meetingId: dbEvent.meetingId
                }
              })
              console.log(`Deleted event ${dbEvent.meetingId} from the database.`);
            }
          }


          events.data.items.map(async(meeting)=>{
            const meetings = await client.meetings.findFirst({
              where: {
                meetingId: meeting.id
              }
            })
    
            console.log(meeting.start.dateTime)
            if(!meetings){
              await client.meetings.create({
                data: {
                  userEmail: roomMail.Room.userEmail,
                  roomMail: roomMail.Room.resourceEmail,
                  meetingId: meeting.id,
                  startTime: meeting.start.dateTime,
                  title: meeting.summary || "(no title)",
                  description: meeting.description || "(no description)",
                  endTime: meeting.end.dateTime,
                  status: "false",
                  meetingLink: meeting.hangoutLink || "No meeting link"
                }
              })
            }else{
              await client.meetings.update({
                where: {
                  meetingId: meeting.id
                }, data: {             
                    userEmail: roomMail.Room.userEmail,
                    roomMail: roomMail.Room.resourceEmail,
                    meetingId: meeting.id,
                    startTime: meeting.start.dateTime,
                    title: meeting.summary || "(no title)",
                    description: meeting.description || "(no description)",
                    endTime: meeting.end.dateTime,
                    status: "false",
                    meetingLink: meeting.hangoutLink || "No meeting link"              
                }
              })
            }
    
          })

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