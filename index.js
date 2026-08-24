import axios from "axios";
import twilio from "twilio";

const {
  ZOHO_CLIENT_ID,
  ZOHO_CLIENT_SECRET,
  ZOHO_REFRESH_TOKEN,
  ZOHO_ACCOUNT_OWNER,
  ZOHO_APP_NAME,
  ZOHO_REPORT_NAME,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_FROM,
  TEST_ATTENDEE_PHONE
} = process.env;

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function getZohoAccessToken() {
  const url = `https://accounts.zoho.in/oauth/v2/token`;
  const res = await axios.post(url, null, {
    params: {
      refresh_token: ZOHO_REFRESH_TOKEN,
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      grant_type: "refresh_token"
    }
  });
  return res.data.access_token;
}

async function getUpcomingMeetings(accessToken) {
  const url = `https://creator.zoho.in/api/v2/${ZOHO_ACCOUNT_OWNER}/${ZOHO_APP_NAME}/report/${ZOHO_REPORT_NAME}`;
  const res = await axios.get(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
  });

  const now = new Date();
  const meetings = res.data.data || [];

  return meetings.filter(m => {
    if (m.Reminder_Sent === true) return false;
    const start = new Date(m.Start_Time);
    const diffMin = (start - now) / 60000;
    return diffMin >= 9 && diffMin <= 11;
  });
}

async function sendWhatsAppReminder(meeting) {
  const phone = TEST_ATTENDEE_PHONE;
  const body = `Reminder: Your meeting "${meeting.Meeting_Title}" starts in 10 minutes.\nJoin here: ${meeting.Meeting_Link}`;

  await twilioClient.messages.create({
    from: TWILIO_WHATSAPP_FROM,
    to: phone,
    body
  });

  console.log(`Sent reminder for meeting: ${meeting.Meeting_Title}`);
}

async function markReminderSent(accessToken, meeting) {
  const url = `https://creator.zoho.in/api/v2/${ZOHO_ACCOUNT_OWNER}/${ZOHO_APP_NAME}/report/${ZOHO_REPORT_NAME}/${meeting.ID}`;
  await axios.patch(
    url,
    { data: { Reminder_Sent: true } },
    { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
  );
}

async function run() {
  const accessToken = await getZohoAccessToken();
  const meetings = await getUpcomingMeetings(accessToken);

  console.log(`Found ${meetings.length} meeting(s) due for reminder.`);

  for (const meeting of meetings) {
    await sendWhatsAppReminder(meeting);
    await markReminderSent(accessToken, meeting);
  }
}

run().catch(err => {
  console.error("Error:", err.response?.data || err.message);
  process.exit(1);
});
