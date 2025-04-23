const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const app = express();

app.set('views', path.join(__dirname, 'views')); // กำหนดที่อยู่ของโฟลเดอร์ views
app.set('view engine', 'ejs');  // ใช้ EJS เป็นเทมเพลตเอนจิน

const upload = multer({ dest: 'uploads/' });  // รับไฟล์จากฟอร์มทั้งหมด

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // <-- serve form.html ได้เลย

app.use((req, res, next) => {
    console.log("Request received: ", req.method, req.url); // เพิ่มเพื่อดูว่ามีคำขอหรือไม่
    next();  // ให้ไปยัง middleware ถัดไป
});
const imageFields = [];
for (let i = 1; i <= 50; i++) {
  imageFields.push({ name: `image_${i}`, maxCount: 1 });
}
app.get('/', (req, res) => {
  res.render('form');  // Render form.ejs
});

app.post('/', upload.fields(imageFields), (req, res) => {
    console.log("Files received:", req.files);  // ตรวจสอบว่าไฟล์ถูกส่งมาหรือไม่
    console.log("Form data:", req.body);  // ตรวจสอบข้อมูลที่ได้รับจากฟอร์ม

    const { project, customer, parcel, date, inspector } = req.body;

    const items = [];
    let i = 1;
    
    // ตรวจสอบจำนวนรายการที่ผู้ใช้กรอก
  while (req.body[`status_${i}`]) {
  items.push({
    item_no: i,
    status: req.body[`status_${i}`],
    title: req.body[`title_${i}`],
    work: req.body[`work_${i}`],
    item: req.body[`item_${i}`],
    note: req.body[`note_${i}`],
    image: req.files[`image_${i}`]?.[0]?.path || null
  });
  i++;
}

  
    // Debugging: เช็คว่า items ที่รับมาเป็นอะไรบ้าง
    console.log("Items:", items);
  
    const filename = `QC_Report_${moment().format('YYYYMMDDHHmmss')}.pdf`;
    const filepath = path.join(__dirname, filename);
  
   // ใหม่ – ย้ายการลบไฟล์ไปทำหลัง response ปิด
generatePDF({ project, customer, parcel, date, inspector, items }, filepath, () => {

  // ส่งไฟล์ให้ดาวน์โหลด (ตั้ง header เป็น attachment ให้อัตโนมัติ)
  res.download(filepath, filename, (err) => {
    if (err) console.error(err);
  });

  // ลบไฟล์หลัง client รับเสร็จจริง ๆ
  res.on('finish', () => {
    fs.unlink(filepath, () => {});
  });
});

  });

  function generatePDF(data, filepath, callback) {
    const doc = new PDFDocument({ size: 'A4', margin: 30 });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    doc.registerFont('THSarabunNew', path.join(__dirname, 'fonts/THSarabunNew.ttf'));
    doc.registerFont('THSarabun-Bold', path.join(__dirname, 'fonts/THSarabun-Bold.ttf'));
    doc.font('THSarabunNew');

    const { project, customer, parcel, date, inspector, items } = data;

    doc.image('./static/logo.png', { fit: [150, 100] });
    doc.moveDown();
    doc.fontSize(16);
    doc.font('THSarabun-Bold').text(`โครงการ:`, { continued: true });
    doc.font('THSarabunNew').text(` ${project}`);
    doc.font('THSarabun-Bold').text(`แปลงเลขที่:`, { continued: true });
    doc.font('THSarabunNew').text(` ${parcel}`);
    doc.font('THSarabun-Bold').text(`ตรวจวันที่:`, { continued: true });
    doc.font('THSarabunNew').text(` ${date}`);
    doc.font('THSarabun-Bold').text(`ลูกค้า:`, { continued: true });
    doc.font('THSarabunNew').text(` ${customer}`);
    doc.font('THSarabun-Bold').text(`ตรวจสอบโดย:`, { continued: true });
    doc.font('THSarabunNew').text(` ${inspector}`);

    doc.moveDown(1.5);

    const itemsPerRow = 2;
    const boxWidth = 250;
    const boxHeight = 242;
    let x = doc.x;
    let y = doc.y;
    let col = 0;
    const gap = 20;

    // ---- helper -------------------------------------------------
// ฟังก์ชัน
function printPageNumber(n) {
  const rightX  = doc.page.width  - doc.page.margins.right;
  const bottomY = doc.page.height - doc.page.margins.bottom + 5;
  doc.fontSize(12)
     .fillColor('black')
     .text(`หน้า ${n}`, rightX, bottomY, { align:'right' });
}

// ---------- หน้าแรก ----------
let pageNum = 1;          // ตัวแปรเดียวพอ
printPageNumber(pageNum); // ✔ เรียกถูกแล้ว

// ---------- หน้าถัดไป ----------
doc.on('pageAdded', () => {
  pageNum += 1;
  printPageNumber(pageNum);
});

  
    // ---------- ลูปรายการ ----------
    items.forEach(item => {

      // ---------- คำนวณความสูงเนื้อหาจริง ----------
  const labelH = 20;
  const imgH   = 100;
  const padY   = 10;                       // เว้นระยะใต้ภาพ
  const keyW   = boxWidth * 0.20;
  const valW   = boxWidth * 0.80;
  const imgMaxH = 100;  
  const padTop  = 10;               // เว้นระยะด้านบน (ระหว่าง label และรูป)
  const padBot  = 10;               // เว้นระยะด้านล่าง (ระหว่างรูปและตาราง)

  let contentH = labelH + padTop + imgH + padY;  // label + margin + image + margin
  const kvRows = [
    ['สถานะ', item.status || '-'],
    ['หัวข้อ', item.title  || '-'],
    ['งาน'  ,  item.work   || '-'],
    ['รายการ', item.item   || '-'],
    ['หมายเหตุ', item.note || '-']
  ];

  // คำนวณความสูงของแต่ละแถวในตาราง
  const rowInfo = kvRows.map(([k, v]) => {
    const tH = doc.heightOfString(v || '-', { width: valW - 8 }) + 4;
    contentH += tH;
    return { k, v, h: tH };
  });

  // คำนวณความสูงของกล่อง
  const boxH = Math.max(250, contentH);  // กรอบสูงเท่ากับจริง แต่ไม่ต่ำกว่า 250

  // ---------- ล้นหน้าหรือไม่ ----------
  if (y + boxH > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    x = doc.page.margins.left;
    y = doc.page.margins.top;
    col = 0;
  }

  // ---------- แถวใหม่ในหน้าเดียวกัน ----------
  if (col === itemsPerRow) {
    col = 0;
    x = doc.page.margins.left;
    y += boxH + gap;                         // ใช้ boxH ที่คำนวณได้
  }

  // ---------- วาดกรอบใหญ่ ----------
  doc.rect(x, y, boxWidth, boxH).stroke('#cccccc');

  // ---------- วาด label ----------
  doc.save().rect(x + 1, y + 1, boxWidth - 2, labelH - 2).fill('#caa34c').restore();
  doc.font('THSarabun-Bold').fontSize(14)
     .fillColor('black')
     .text(`รายการที่: ${item.item_no}`, x, y + 3, { width: boxWidth, align: 'center' });

  // ---------- คำนวณพื้นที่ว่างสำหรับรูปภาพ ----------
  const kvHeight = rowInfo.reduce((acc, { h }) => acc + h, 0);  // คำนวณความสูงของตารางทั้งหมด
  const freeSpace = boxH - labelH - kvHeight - padTop - padBot;  // พื้นที่ว่างที่เหลือ
  const usableH = Math.min(imgMaxH, freeSpace);   // สูงจริงที่จะใช้
  const imgY = y + labelH + padTop + (freeSpace - usableH) / 2; // กึ่งกลางช่องว่าง
  const imgW = boxWidth - 30;
  const imgX = x + (boxWidth - imgW) / 2;

  // ---------- วาดรูปภาพหรือข้อความไม่พบรูป ----------
  if (item.image && fs.existsSync(item.image)) {
    doc.image(item.image, imgX, imgY, {
      fit: [imgW, usableH],
      align: 'center',
      valign: 'center'
    });
  } else {
    doc.fontSize(12).fillColor('grey')
       .text('ไม่พบรูปภาพ', x, imgY + usableH / 2 - 6,
             { width: boxWidth, align: 'center' })
       .fillColor('black');
  }

 

    
/* ---------- คำนวณความสูงตาราง ---------- */
const kvHeight2 = rowInfo.reduce((sum,r) => sum + r.h, 0);

/* ---------- จุดเริ่มตาราง ---------- */
let rowY = y + boxH - kvHeight2;   // ชิด bottom ของกล่อง

/* ---------- วาด key‑value ---------- */
rowInfo.forEach(({k,v,h})=>{
  doc.rect(x, rowY, keyW, h).stroke('#cccccc');
  doc.font('THSarabun-Bold').fontSize(12)
     .text(k, x+4, rowY+4, {width:keyW-8});

  doc.rect(x+keyW, rowY, valW, h).stroke('#cccccc');

  if (k==='สถานะ'){
       const clr = v==='ผ่าน' ? '#00bf62' : '#f93434';
       doc.save().rect(x+keyW, rowY, valW, h).fill(clr).restore()
          // .fillColor('white');
  }else{
       doc.fillColor('black');
  }
  doc.font('THSarabunNew')
     .text(v||'-', x+keyW+4, rowY+4, {width: valW-8});

  rowY += h;
});
      /* ---------- ตำแหน่งกล่องถัดไป ---------- */
      col++;
      if (col === itemsPerRow){
          col = 0;
          x = doc.page.margins.left;
          y += boxH + gap;                       // เลื่อนตาม boxH จริง
      }else{
          x += boxWidth + gap;
      }
    });
    
    doc.end();
    stream.on('finish', callback);
}




app.listen(3000, () => console.log('Server running on http://localhost:3000'));
