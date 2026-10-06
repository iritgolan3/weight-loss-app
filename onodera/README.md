# Sushi Ginza Onodera — New York · 3D model

מודל תלת-ממדי של מסעדת **Sushi Ginza Onodera** בניו יורק (‎461 Fifth Avenue, פעלה 2016–2023), שנבנה ב-**Blender 5.0** מקוד פייתון.

| קובץ | מה זה |
|---|---|
| `index.html` | צופה תלת-ממדי בדפדפן (three.js) עם מבטים מוכנים: מבט על, הדלפק, מושב אורח, עמדת השף, שולחנות, התקרה הכפולה, החזית |
| `onodera.blend` | קובץ Blender מלא (מצלמות, תאורת Cycles, חומרים וטקסטורות ארוזים) |
| `onodera.glb` | אותו מודל ב-glTF לשימוש בכל תוכנה / מנוע משחק |
| `renders/` | רינדורים ב-Cycles |
| `blender/` | קוד המקור שבונה את כל הסצנה |

## בנייה מחדש

```bash
pip install bpy==5.0.1            # Python 3.11
python blender/build_onodera.py -- out --glb             # בונה out/onodera.blend + out/onodera.glb
python blender/build_onodera.py -- out --render           # + רינדור כל המבטים (Cycles, CPU)
python blender/build_onodera.py -- out --render --quick --only=counter   # תצוגה מקדימה מהירה
```

## על מה המודל מבוסס

**החזית (מדויקת יחסית):** תמונות Google Street View מ-2016 עד 2022, מיושרות עם קנה מידה במטרים.
- שני מפרצים בשדרה החמישית, בין הרחובות 40 ו-41: חלון ברוחב כ-2.8 מ׳ ודלת ברוחב כ-2.35 מ׳.
- ביניהם עמודי אבן ברוחב 1.2–1.35 מ׳ עם רצועות אופקיות מעוגלות.
- בסיס שחור בגובה 0.45 מ׳.
- פס שלט שחור בגובה 4.0–4.5 מ׳, עם "SUSHI GINZA / ONODERA" באותיות זהב.
- זיגוג עליון בתיבה בולטת עד כ-7.4 מ׳.
- דלת זכוכית עם רשת ברונזה וידית טבעת גדולה מפליז, וגזעי ליבנה לבנים בכד כהה מאחוריה.
- מסך קומיקו (סבכת עץ) בחלון.
- המודל מציג את החזית של 2021–2023, אחרי שהוסרו הגמלונים שהיו מעל השלטים.

**הפנים (על בסיס תיאורים כתובים):** תמונות פנים לא היו נגישות מסביבת העבודה, ולכן הפנים נבנה לפי מדריך מישלן, ביקורות וקרדיטים של המעצב והקבלן.
- דלפק בצורת L מלוח אחד של הינוקי מאיסה, עם 16 מושבים.
- ארבעה שולחנות לארבעה.
- חלל בגובה כפול ("כמו קתדרלה").
- קיר אריחי קרמיקה בסגנון ביזן מאחורי הדלפק, מסודרים ברשת כמו שוג׳י.
- טיח עבודת יד בגווני אדמה, ואבן אויה (Ōya).
- רצפת גרניט שחור מוברש.
- פס אור חם מאחורי סבכת עץ בגובה כ-3 מ׳.
- "קוביית שוג׳י" מעץ בהיר בכניסה, שבה בודקים הזמנות.

המידות המדויקות של הפנים, סידור המושבים והחפצים על הדלפק משוחזרים בהשערה מושכלת, לא ממדידה.

מקורות עיקריים: Michelin Guide; Shotenkenchiku (מרץ 2017, עיצוב: Yosuke Karasawa; תאורה: Ray Design); Gallin (קבלן); YT Design; Wikipedia ‏(Sushi Ginza Onodera, ‏461 Fifth Avenue); ביקורות ב-Dined There Sipped That, Desired Tastes, The Sushi Legend, Savory Travels.

---

*English:* procedural Blender model of Sushi Ginza Onodera NYC (461 Fifth Ave, 2016–2023).
- **Street front:** modelled from rectified Street View imagery.
- **Interior:** reconstructed from published descriptions:
  - L-shaped single-plank hinoki counter with 16 seats, plus four 4-tops;
  - double-height room;
  - Bizen-tile wall behind the counter;
  - Oya stone, black granite and earthen plaster;
  - a light-wood entry cube.
- **To rebuild:** `python blender/build_onodera.py -- out --glb --render` with `bpy` 5.0.
