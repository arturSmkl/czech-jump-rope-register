const PDFDocument = require('pdfkit');
const path = require('path');

const generateOverviewPDF = async (req, res, db) => {
  const logoPath = path.join(process.cwd(), 'assets', 'logo.png');
  const fontPath = path.join(process.cwd(), 'assets', 'Roboto-Regular.ttf');
  const boldFontPath = path.join(process.cwd(), 'assets', 'Roboto-Bold.ttf');
  try {
    // DATA GATHERING
    const [collectivesSnap, membersSnap] = await Promise.all([
      db.collection("collective_members").where("membership_extinction_date", "==", null).get(),
      db.collection("registered_members").where("membership_extinction_date", "==", null).get()
    ]);

    const stats = {
      date: new Date().toLocaleDateString('cs-CZ'),
      totalActiveCollectives: collectivesSnap.size,
      totalClubMembers: 0,
      totalIndividualMembers: 0,
      totalCoaches: 0,
      totalReferees: 0,
      clubs: []
    };

    const clubMap = new Map();
    collectivesSnap.forEach(doc => {
      clubMap.set(doc.id, { name: doc.data().name, members: 0, coaches: 0, referees: 0 });
    });

    membersSnap.forEach(doc => {
      const m = doc.data();
      const clubId = m.collective_member_ref;
      if (m.coach) stats.totalCoaches++;
      if (m.referee) stats.totalReferees++;

      if (clubId && clubMap.has(clubId)) {
        stats.totalClubMembers++;
        const club = clubMap.get(clubId);
        club.members++;
        if (m.coach) club.coaches++;
        if (m.referee) club.referees++;
      } else {
        stats.totalIndividualMembers++;
      }
    });

    stats.clubs = Array.from(clubMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    // PDF SETUP
    const doc = new PDFDocument({ margin: 50, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=prehled_zakladny_${stats.date}.pdf`);

    // THE PROMISE WRAPPER
    // This ensures Firebase waits for the stream to finish before closing the function
    const pdfStream = new Promise((resolve, reject) => {
      doc.pipe(res);

      try {
        doc.font(fontPath);
        doc.image(logoPath, (doc.page.width - 153) / 2, doc.y, { fit: [153, 60] });
      } catch (fileErr) {
        reject(new Error(`Asset missing: ${fileErr.message}`));
        return;
      }

      doc.y += 80;

      doc.fontSize(20).text('Přehled členské základny Czech Jump Rope', { align: 'center' });
      doc.fontSize(10).text(`K datu: ${stats.date}`, { align: 'center' }).moveDown(2);

      doc.fontSize(14).text('Exekutivní shrnutí', { underline: true }).moveDown(0.5);
      doc.fontSize(11)
         .text(`Celkový počet aktivních kolektivních členů: ${stats.totalActiveCollectives}`)
         .text(`Celkový počet aktivních evidovaných členů: ${stats.totalClubMembers}`)
         .text(`Celkový počet aktivních individuálních členů: ${stats.totalIndividualMembers}`)
         .text(`Celkový počet aktivních trenérů: ${stats.totalCoaches}`)
         .text(`Celkový počet aktivních rozhodčích: ${stats.totalReferees}`)
         .moveDown(2);

      // --- TABLE LOGIC ---
      const tableTop = 350;
      let currentY = tableTop;

      // Helper to draw headers
      const drawHeaders = (y) => {
        doc.fontSize(12).font(boldFontPath);
        doc.text('Jméno kolektivního člena', 50, y);
        doc.text('Členové', 300, y);
        doc.text('Trenéři', 400, y);
        doc.text('Rozhodčí', 480, y);
        doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
        return y + 25;
      };

      currentY = drawHeaders(currentY);
      doc.font(fontPath).fontSize(10);

      stats.clubs.forEach((club) => {
        // If we are near the bottom (A4 is ~842 points high)
        if (currentY > 700) {
          doc.addPage();
          currentY = 50; // Reset Y to the top of the new page
          currentY = drawHeaders(currentY);
          doc.font(fontPath).fontSize(10);
        }

        doc.text(club.name, 50, currentY, { width: 240, ellipsis: true });
        doc.text(club.members.toString(), 300, currentY);
        doc.text(club.coaches.toString(), 400, currentY);
        doc.text(club.referees.toString(), 480, currentY);
        
        currentY += 20; // Move down for the next row
      });

      doc.end();

      // Resolve when the document is finished
      doc.on('end', () => resolve());
      doc.on('error', (err) => reject(err));
    });

    await pdfStream;

  } catch (error) {
    console.error("PDF_ERROR:", error);
    // Only send error if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || "Failed to generate PDF" });
    } else {
      res.end(); 
    }
  }
};

module.exports = { generateOverviewPDF };