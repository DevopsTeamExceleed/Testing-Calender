const express = require("express")
const { PrismaClient } = require("@prisma/client")

const app = express()
const client = new PrismaClient()

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

app.post("/webhook", async (req, res) => {
    const channelId = req.header("X-Goog-Channel-ID");
    const resourceId = req.header("X-Goog-Resource-ID");
    const resourceState = req.header("X-Goog-Resource-State");
  
    console.log("Notification received:", { channelId, resourceId, resourceState });
  
    const user = await client.user.findFirst({
      where: {
        email: "support@exceleed.in"
      }
    })
  
    if (resourceState === "exists") {
      try {
        const calendar = google.calendar("v3");
        const oAuth2Client = new google.auth.OAuth2();
        oAuth2Client.setCredentials({
          access_token: user?.accessToken,
          refresh_token: user?.refreshToken,
        });
  
        const events = await calendar.events.list({
          auth: oAuth2Client,
          calendarId: "primary", // Replace with your calendar ID
          timeMin: new Date().toISOString(),
        });
  
        console.log("Updated events:", events.data.items);
        // Sync with your database
      } catch (err) {
        console.error("Error fetching updated events:", err);
      }
    }
  
    res.status(200).end(); // Acknowledge receipt
  });

app.listen(8000, ()=>{
    console.log("Server started at port 8000")
})