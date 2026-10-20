# GearLoan — Requirements Gathering (TEST CASE)

> **TEST CASE — fictional.** Written for BA kit test C. Company, people and numbers are invented.
> Source: BA kit test fixture, 2026-10-20
> Read-only for the BA kit.

## 1. Handoff

Hi! I’m moving to another account, so this one is yours now. Short version: Brightwater Labs wants a small tool for lending equipment to employees. Today it is an Excel file on Ken’s laptop. Marta (sponsor) wants “something people can click” by the end of the month to show the leadership team. Notes from our two sessions are below. Some things contradict each other, and I didn’t have time to resolve them. Good luck!

## 2. Context

- Brightwater Labs: about 80 people, a hybrid week, one office.
- IT lends laptops, monitors, headsets, webcams and “some other stuff” to employees.
- The loan log is an Excel file (“GearLog.xlsx”) that only Ken can edit.
- Items get lost. Nobody knows who has what. Overdue items are found only at the yearly audit.

## 3. Workshop 1 — Problem

Date: 2026-10-05
Attendees: Marta Ruiz (Operations lead, sponsor), Ken Okafor (IT support), Lena Vogt (Finance, asset audit)

- **Marta:** “I want people to see what is available and take it without emailing Ken. Self-service.”
- **Ken:** “Fine, but I am one person. I will not run another system. No servers, no logins to manage, nothing I have to patch.”
- **Lena:** “For the audit I need to know exactly who had which item and when. Names are not enough — two people here are called Alex Kim.”
- **Ken:** “Standard loans are 14 days. After that the item comes back.”
- **Marta:** “Remote people keep a monitor for months. That’s fine with me.”
- **Lena:** “Every item has an asset tag, like BW-0142. Use that.”
- **Marta:** “Could people reserve a webcam for next Tuesday? We had three teams fighting over the conference kit.”
- **Ken:** “Reservations are a nightmare. First come, first served.”
- Open: how many items there are. Ken: “Around 150, maybe more, I’d have to count.”

## 4. Workshop 2 — Rules

Date: 2026-10-12
Attendees: Marta Ruiz, Ken Okafor, Lena Vogt, Priyanka Das (HR)

- **Ken:** “When someone takes an item, they mark it taken. When they bring it back, I check it and mark it returned. Only I can say it’s returned — people say ‘returned’ and it’s in a drawer at home.”
- **Marta:** “Overdue reminders would be great. An email the day before.”
- **Ken:** “No email integration. See workshop 1.”
- **Priyanka:** “Keep personal data to the minimum. We should not keep a history of who borrowed what forever.”
- **Lena:** “Finance must keep the loan history for at least one year for the audit.”
- **Marta:** “Damaged items — I don’t know. Ken decides?”
- **Ken:** “I just write ‘broken’ in the Excel.”
- **Marta:** “For the demo it must work on a phone. People are in the corridor when they pick something up.”
- Decision: the Excel file is not migrated for the demo; demo data is fine.
- Open: weekends and holidays — does the loan clock run? Nobody knew.
- Open: what “by the end of the month” means exactly — Marta to confirm the demo date.
