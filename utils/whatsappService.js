import axios from 'axios';

/**
 * Service to send WhatsApp notifications for doctor bookings.
 * Currently configured to log to console and simulate API calls.
 */
class WhatsAppService {
    /**
     * Send booking confirmation message to the patient.
     * @param {Object} booking - The confirmed DoctorBooking object.
     */
    async sendBookingConfirmation(booking) {
        try {
            const { patientName, patientPhone, doctorName, appointmentDate, appointmentTime } = booking;

            // Format phone number (ensure it includes country code)
            const formattedPhone = patientPhone.startsWith('+') ? patientPhone : `+91${patientPhone}`;

            const appointmentDateStr = new Date(appointmentDate).toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            const message = `Namaste ${patientName}! 🙏

Thank you for joining Hridved. Your appointment with Dr. ${doctorName} has been confirmed.

📅 Date: ${appointmentDateStr}
⏰ Time: ${appointmentTime}

Our team will share the meeting link shortly before the appointment. 

Stay Healthy,
Team Hridved 🌿`;

            console.log(`[WHATSAPP-SERVICE] Sending confirmation to ${formattedPhone}:`);
            console.log('-------------------------------------------');
            console.log(message);
            console.log('-------------------------------------------');

            // TODO: Integrate with actual WhatsApp API (Interakt, WATI, Twilio, etc.)
            // Example for an API:
            /*
            await axios.post('WHATSAPP_API_URL', {
                apiKey: process.env.WHATSAPP_API_KEY,
                to: formattedPhone,
                message: message
            });
            */

            return { success: true, message: 'Notification logged successfully' };
        } catch (error) {
            console.error('[WHATSAPP-SERVICE] Error sending confirmation:', error.message);
            return { success: false, error: error.message };
        }
    }
}

export default new WhatsAppService();
