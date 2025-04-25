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

app.use('/static', express.static(path.join(__dirname, 'static')));

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
 
    const { houseType,canvasImage ,floor, project, otherProject ,customer, parcel, round, date, inspector } = req.body;
    let projectName = project === 'other' && otherProject ? otherProject : project;
    console.log("Project selected:", project);
    console.log("Other project:", otherProject);
   
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
  
const floorMap = {
  '1': path.join(__dirname, 'static', 'floor1.png'),
  '2': path.join(__dirname, 'static', 'floor2.jpg')
};

const planPath = floorMap[floor];  // floor คือ '1' หรือ '2'

   // ใหม่ – ย้ายการลบไฟล์ไปทำหลัง response ปิด
generatePDF({ houseType,floor,canvasImage ,planPath, projectName,project, customer, parcel, round, date, inspector, items }, filepath, () => {

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
    doc.registerFont('DejaVuSans', path.join(__dirname, 'fonts/DejaVuSans.ttf'));
    doc.registerFont('THSarabunNew', path.join(__dirname, 'fonts/THSarabunNew.ttf'));
    doc.registerFont('THSarabun-Bold', path.join(__dirname, 'fonts/THSarabun-Bold.ttf'));
    doc.font('THSarabunNew');

    const { houseType,floor,canvasImage ,planPath, projectName,project, customer, parcel, round, date, inspector, items } = data;

    // doc.image('./static/logo.png', { fit: [150, 100] });

/* ---------- หน้า 1 : แบบบ้าน ---------- */
/* ---------- หน้า 1 : แบบบ้าน ---------- */
const pageW   = doc.page.width;
const pageH   = doc.page.height;  // ความสูงของหน้า
const marginX = doc.page.margins.left;
const fontSz  = 20;

/* 1. สร้างสตริงเต็ม */
const fullText = `แบบบ้าน: ${houseType}`;

/* 2. วัดความกว้างสตริงนี้ (ใช้ฟอนต์ของ value เพราะยาวกว่า) */
doc.font('THSarabunNew').fontSize(fontSz);   // ตั้งฟอนต์ก่อนวัด
const textW = doc.widthOfString(fullText);

/* 3. คำนวณตำแหน่ง X ที่จะทำให้กึ่งกลาง */
const startX = (pageW - textW) / 2;
const startY = doc.y;   // ตำแหน่ง Y ปัจจุบัน

// เพิ่มพื้นหลังสีฟ้า
const backgroundHeight = 80; // ความสูงของพื้นที่พื้นหลัง
doc.rect(marginX, startY - 10, pageW - 2 * marginX, backgroundHeight).fill('#e0f0ff'); // เติมพื้นหลังสีฟ้า

/* 4. วาด label (ตัวหนา) + value (ปกติ) ต่อเนื่องกัน */
doc.font('THSarabun-Bold').fillColor('#000000').text('แบบบ้าน ', startX, startY, { continued: true });  // ใช้สีดำ
doc.font('THSarabunNew').fillColor('#000000').text(houseType); // ใช้สีดำ

/* 5. บรรทัดถัดไป—ชั้นที่ */
doc.moveDown(0.5);

/* รีเซ็ต x ไปที่ margin ซ้าย */
doc.x = doc.page.margins.left;

const floorText = `ชั้น ${floor}`;
doc.font('THSarabunNew').fontSize(18).fillColor('#000000')  // ใช้สีดำ
   .text(floorText, { align: 'center' });


   doc.moveDown(1);
/* ถ้ามีภาพแปลนให้แสดง */
// ใน generatePDF
/* ถ้ามีภาพแปลนให้แสดง */
// after you wrote houseType / floor ------------------------------------------------
if (data.canvasImage && data.canvasImage.startsWith('data:image')) { 
  const buf = Buffer.from(
      data.canvasImage.split(',')[1], 'base64');

  const imageWidth = 500;
  const imageHeight = 350;

  // คำนวณ x ให้อยู่กลางหน้ากระดาษ
  const pageWidth = doc.page.width;
  const x = (pageWidth - imageWidth) / 2;

  doc.image(buf, x, doc.y, {
     width: imageWidth,
     height: imageHeight
  });

  doc.moveDown(1);
}

let pageNum = 1;

// ฟังก์ชันพิมพ์หมายเลขหน้า
function printPageNumber(n) {
  const rightX  = doc.page.width  - doc.page.margins.right;
  const bottomY = doc.page.height - doc.page.margins.bottom + 5;
  doc.fontSize(12)
     .fillColor('black')
     .text(`Page ${n}`, rightX, bottomY, { align: 'right' });
}

// พิมพ์หมายเลขหน้าในหน้าแรก
printPageNumber(pageNum);

// เพิ่มหน้าใหม่
doc.addPage();  // เพิ่มหน้าใหม่
pageNum += 1;   // เพิ่มหมายเลขหน้า

// พิมพ์หมายเลขหน้าในหน้าที่ 2 หลังจากเพิ่มหน้า

//
// ฟังก์ชันเพื่อแปลงวันที่เป็นรูปแบบ xx/xx/xxxx
// ฟังก์ชันเพื่อแปลงวันที่เป็นรูปแบบ xx/xx/xxxx
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0'); // ให้มี 2 หลัก
  const month = String(date.getMonth() + 1).padStart(2, '0'); // เดือนเริ่มต้นจาก 0
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// แปลงจาก string (เช่น "2025-04-25") เป็น Date object ก่อน
const dateObj = new Date(date);

// ใช้ฟังก์ชันแปลงรูปแบบ
const formattedDate = formatDate(dateObj);


    doc.moveDown();
    doc.fontSize(18);
    doc.font('THSarabun-Bold').text(`โครงการ :`, { continued: true });
    doc.font('THSarabunNew').text(` ${projectName}`);
    doc.font('THSarabun-Bold').text(`แปลงเลขที่ :`, { continued: true });
    doc.font('THSarabunNew').text(` ${parcel}`);
    // doc.font('THSarabun-Bold').text(`ตรวจครั้งที่:`, { continued: true });
    // doc.font('THSarabunNew').text(` ${round}`);
    doc.font('THSarabun-Bold').text(`วันที่ตรวจ (รอบแรก) :`, { continued: true });
    doc.font('THSarabunNew').text(` ${formattedDate}`);
    doc.font('THSarabun-Bold').text(`วันที่ตรวจ (รอบสอง) :`);
    // doc.font('THSarabunNew').text(` ${date}`);
    doc.font('THSarabun-Bold').text(`ลูกค้า :`, { continued: true });
    doc.font('THSarabunNew').text(` ${customer}`);
    doc.font('THSarabun-Bold').text(`ตรวจสอบโดย :`, { continued: true });
    doc.font('THSarabunNew').text(` ${inspector}`);

    doc.moveDown(1);

    

    // ---- helper -------------------------------------------------

    const itemsPerRow = 2;
    const boxWidth = 258;
    const boxHeight = 242;
    let x = doc.x;
    let y = doc.y;
    let col = 0;
    const gap = 20;


    // printPageNumber(pageNum);
    // // ---------- หน้าถัดไป ----------
    // doc.on('pageAdded', () => {
    //   pageNum += 1;
    // });
    

// ---------- หน้าถัดไป ----------
printPageNumber(pageNum);

    // ---------- ลูปรายการ ----------
    items.forEach(item => {

      // ---------- คำนวณความสูงเนื้อหาจริง ----------
  const labelH = 20;
  const imgH   = 100;
  const padY   = 10;                       // เว้นระยะใต้ภาพ
  const keyW   = boxWidth * 0.25;
  const valW   = boxWidth * 0.75;
  const imgMaxH = 100;  
  const padTop  = 10;               // เว้นระยะด้านบน (ระหว่าง label และรูป)
  const padBot  = 10;               // เว้นระยะด้านล่าง (ระหว่างรูปและตาราง)

  let contentH = labelH + padTop + imgH + padY;  // label + margin + image + margin
  const kvRows = [
    ['สถานะ :', item.status || '-'],
    ['หัวข้อ :', item.title  || '-'],
    ['งาน :'  ,  item.work   || '-'],
    ['รายการ :', item.item   || '-'],
    ['หมายเหตุ :', item.note || '-'],
    // ['ผลการตรวจสอบ (รอบสอง)', item.note || '-']
    ['ผลการตรวจสอบ (รอบสอง) :', '\u25A1 ผ่าน\t\t\t\u25A1 ไม่ผ่าน']

  ];

//  // คำนวณความสูงของแถวจาก kvRows
// const kvRowHeights = kvRows.map(([k, v]) => 
//   doc.heightOfString(v || '-', { width: valW - 8 }) + 4
// );

// const maxKvRowHeight = Math.max(...kvRowHeights);

// // สร้าง rowInfo จาก kvRows
// const kvRowInfo = kvRows.map(([k, v]) => ({
//   k,
//   v,
//   h: maxKvRowHeight
// }));

// คำนวณความสูงของข้อความจาก data
const dataRowInfo = kvRows.map(([ k, v ]) => {
  const valueText = v || '-';
  const keyText = k;

  // คำนวณความสูงของข้อความใน key
  const keyH = doc.heightOfString(keyText, {
    width: keyW - 8
  });

  // คำนวณความสูงของข้อความใน value
  const valH = doc.heightOfString(valueText, {
    width: valW - 8
  });

  // เลือกความสูงที่มากที่สุดระหว่าง key และ value
  const rowHeight = Math.max(keyH, valH) + 8; // เพิ่ม padding บนล่าง

  return { k, v, h: rowHeight };
});

// รวมข้อมูลทั้งสองแหล่ง...kvRowInfo, 
const rowInfo = [...dataRowInfo];

  const boxH = 320;  // ฟิกซ์ความสูงของกรอบเป็น 250

  
  // ---------- ล้นหน้าหรือไม่ ----------
  if (y + boxH > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    pageNum += 1;
    printPageNumber(pageNum); 
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
       .text('ไม่มีรูปภาพ', x, imgY + usableH / 2 - 6,
             { width: boxWidth, align: 'center' })
       .fillColor('black');
  }

 

    
/* ---------- คำนวณความสูงตาราง ---------- */
const kvHeight2 = rowInfo.reduce((sum,r) => sum + r.h, 0);

/* ---------- จุดเริ่มตาราง ---------- */
let rowY = y + boxH - kvHeight2;   // ชิด bottom ของกล่อง

/* ---------- วาด key‑value ---------- */
rowInfo.forEach(({k, v, h}) => {
  doc.rect(x, rowY, keyW, h).stroke('#cccccc');
  doc.font('THSarabun-Bold').fontSize(12)
   .text(k, x + 4, rowY + 4, {
     width: keyW - 2,
     lineBreak: true
   });

  doc.rect(x + keyW, rowY, valW, h).stroke('#cccccc');

  if (k === 'สถานะ :') {
    const clr = v === 'ผ่าน' ? '#00bf62' : '#f93434';
    doc.save().rect(x + keyW, rowY, valW, h).fill(clr).restore();
  } else {
    doc.fillColor('black');
  }
// ✅ เงื่อนไขพิเศษ: กล่องเช็ค "ผ่าน / ไม่ผ่าน"
if (k === 'ผลการตรวจสอบ (รอบสอง) :') {
  const baseX = x + keyW + 4;
  const baseY = rowY + 6;

  doc.font('DejaVuSans').text('\u25A1', baseX, baseY, { continued: true });
  doc.font('THSarabunNew').text(' ผ่าน', { continued: false });
  
  doc.font('DejaVuSans').text('\u25A1', baseX + 60, baseY, { continued: true });  // ปรับตรงนี้เพื่อขยับ
  doc.font('THSarabunNew').text(' ไม่ผ่าน');

} else {
  doc.font('THSarabunNew')
     .text(v || '-', x + keyW + 4, rowY + 4, { width: valW - 8 });
}


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
    
    // printPageNumber(pageNum);

    // doc.on('pageAdded', () => {
    //   pageNum += 1;
    //   printPageNumber(pageNum);
    // });    
    
    doc.end();
    stream.on('finish', callback);
}




app.listen(3000, () => console.log('Server running on http://localhost:3000'));
