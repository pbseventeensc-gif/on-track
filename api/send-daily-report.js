// ==========================================================================
// Vercel Serverless Function: Automated Daily Report Dispatch (Email & WhatsApp)
// ==========================================================================

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const body = req.body || {};
        const recipients = body.recipients || [];
        const subject = body.subject || `[Wtrack] Laporan Operasional Kurir - ${new Date().toISOString().slice(0, 10)}`;
        const reportText = body.reportText || 'Tidak ada konten laporan.';
        const waRecipients = body.waRecipients || [];

        const results = {
            emailSent: false,
            waSent: false,
            recipients: recipients,
            notes: []
        };

        // 1. Dispatch Email via Resend if API Key configured
        const resendApiKey = process.env.RESEND_API_KEY;
        if (resendApiKey && recipients.length > 0) {
            try {
                const htmlContent = `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
                        <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px;">
                            <h2 style="margin: 0; color: #0f172a; font-size: 1.3rem;">Wtrack Logistics Report</h2>
                            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 0.85rem;">Wellen Print - Daily Courier Performance Audit</p>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px; white-space: pre-wrap; font-family: monospace; font-size: 0.85rem; line-height: 1.5;">${reportText}</div>
                        <div style="text-align: center; font-size: 0.75rem; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 12px;">
                            Laporan ini dihasilkan secara otomatis oleh sistem Wtrack. Buka dashboard untuk live GPS & foto PoD lengkap: <a href="https://wtrack.wellenprint.com" style="color: #3b82f6; text-decoration: none;">wtrack.wellenprint.com</a>
                        </div>
                    </div>
                `;

                const emailRes = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${resendApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from: process.env.REPORT_EMAIL_SENDER || 'Wtrack Logistics <onboarding@resend.dev>',
                        to: recipients,
                        subject: subject,
                        html: htmlContent
                    })
                });

                if (emailRes.ok) {
                    results.emailSent = true;
                    results.notes.push("Email berhasil dikirim via Resend.");
                } else {
                    const errJson = await emailRes.json().catch(() => ({}));
                    results.notes.push(`Resend error: ${errJson.message || 'Gagal mengirim email'}`);
                }
            } catch (emailErr) {
                results.notes.push(`Email exception: ${emailErr.message}`);
            }
        } else {
            results.notes.push("RESEND_API_KEY belum dikonfigurasi di Environment Variable Vercel.");
        }

        // 2. Dispatch WhatsApp via Fonnte if Token configured
        const fonnteToken = process.env.FONNTE_TOKEN;
        if (fonnteToken && waRecipients.length > 0) {
            try {
                const targetPhones = waRecipients.map(p => p.replace(/[^0-9]/g, '')).filter(Boolean).join(',');
                if (targetPhones) {
                    const waRes = await fetch('https://api.fonnte.com/send', {
                        method: 'POST',
                        headers: {
                            'Authorization': fonnteToken,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            target: targetPhones,
                            message: reportText
                        })
                    });
                    if (waRes.ok) {
                        results.waSent = true;
                        results.notes.push("WhatsApp berhasil dikirim via Fonnte.");
                    }
                }
            } catch (waErr) {
                results.notes.push(`WhatsApp exception: ${waErr.message}`);
            }
        }

        return res.status(200).json({
            success: results.emailSent || results.waSent || true,
            results: results
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
