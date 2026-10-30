# AuraTrack

AuraTrack is a privacy-first seizure tracking PWA for people with epilepsy and their caregivers. It records seizures in real time, tracks medications and adherence, supports EEG diary workflows, and generates clinician-friendly reports while keeping primary data local on the device.

> **Not a medical device.** AuraTrack is a personal logging tool and report assistant. It does not diagnose, treat, or replace professional medical advice.

## What's new in 6.0

- **Backups contain everything:** every table and every field. A backup that can't read part of the data fails with an error instead of saving an incomplete copy. Restores report what was skipped and why.
- **Sync carries edits and deletions:** the newest version of a record wins, edit histories are joined, and deletions reach every device (tombstones).
- **Emergency plan settings** (Settings → Recording): the alert time (default 5 minutes) and the cluster rule (default 3 seizures within 8 minutes). The alert measures seizure time, not the aura or the recovery, and reports state the rule used.
- **No-aura seizures:** End seizure can be tapped without ending an aura first. The seizure type can be changed from the summary.
- **After-seizure findings:** grouped, with body areas for numbness, weakness, heaviness, paralysis and similar, plus the time until back to normal.
- **Saved symptom sets** per seizure type with suggested names, most-used symptoms, and remembered custom symptoms.
- **Navigation remembers where you were:** History keeps its filters, and editing returns to the seizure you came from.
- **Faster start-up:** charts, PDF reports, sync and non-English languages load when first used.

Upgrading from 5.x upgrades the on-device database (schema v13); the app can't go back to 5.x on that device afterwards. Make a backup before updating, and update every device you sync with.

## What AuraTrack Does

### Seizure recording

- One-tap start for urgent real-world use
- Caretaker and self-recording modes
- Live phase timing for aura, seizure, and recovery
- Quick timestamped notes during recording
- 4-minute warning, 5-minute emergency alert, 12-minute automatic stop
- Optional seizure video capture when browser/device support is available
- Manual entry flow for past seizures that were not recorded live

### Clinical detail capture

- Guided tagging wizard for seizure type, symptoms, body regions, triggers, and notes
- Drag-to-reorder symptom list
- Editable phase timings after the event
- Event detail view with danger flags, timings, notes, and audit markers

### Medication tracking

- Structured medication list with OD / BD / TDS / QDS / PRN frequencies
- Scheduled times and day-of-week recurrence
- Rescue medication highlighting for emergency use
- Daily dose tracker on the home screen
- Medication history grid with corrections and edited markers
- Browser notification reminders for scheduled doses

### Daily wellbeing tracking

- Optional Daily Wellbeing Check-In for mood and context factors
- Configurable wellbeing factors such as sleep, stress, hydration, missed meals, and other observed context
- Wellbeing history tab for reviewing entries alongside seizure history
- Daily wellbeing reminder that is skipped once an entry has already been logged for the day

### EEG diary

- Optional EEG session tracking
- Activity logging during an EEG session
- Linked seizure references inside the EEG diary view
- EEG diary export support in CSV and PDF/report flows where relevant

### Reports and exports

- Encrypted backup export using a user-supplied passphrase
- Encrypted backup import for restore or device migration
- CSV export for spreadsheet analysis, including seizure, medication, EEG, and wellbeing data
- Printable event log / PDF export
- Neurologist report with medication summary, clinical flags, data-quality notes, event details, and charted trends
- Report charts use a consistent sans-serif font and capped value labels so dense reports remain readable
- Wellbeing correlation chart keeps seizures as bars and plots mood/numeric wellbeing factors as separate labelled line series
- Wellbeing report summaries focus on entries, days covered, top moods, top context factors, and recent entries; AuraTrack does not calculate an "average mood intensity" index
- Monthly seizure diary
- EEG diary preview / PDF export

### Sync and recovery

- Device-to-device sync over PeerJS, WebRTC/LAN, or manual file transfer
- Backup reminders instead of background auto-backup
- Storage protection status in Settings using `navigator.storage.persist()`
- Silent persistence check where the browser allows it, manual retry/request where supported

## Privacy Model

- Primary health data is stored locally in IndexedDB on the device
- No account or backend is required for core use
- Data leaves the device only when the user explicitly exports, prints, syncs, or saves a video file
- Encrypted backups are protected with the passphrase chosen at export time
- CSV, PDF, and video files are standard files and should be handled like sensitive medical documents

## Backup Model

- Auto-backup has been removed
- AuraTrack uses reminder-driven manual backups
- Backups are written as encrypted `.atbak` files
- The encryption key is derived from the passphrase and is not stored by the app
- Import decrypts in memory and does not intentionally leave a plaintext backup copy on disk

## Settings Areas

| Area | Purpose |
|------|---------|
| Identity | User mode, names, date of birth, emergency contact |
| Medications | Medication setup, schedules, reminders, emergency visibility |
| Appearance | Theme, accent color, font size, language |
| Recording | Haptics, EEG diary toggle, quick-note labels |
| Wellbeing | Optional check-in, reminder time, custom wellbeing factor definitions |
| Clinician | Neurologist details, report notes, DOB inclusion |
| Data & Backup | Storage protection, encrypted backup/import, reminder interval, destructive data actions |

## Technology

| Layer | Technology |
|------|------------|
| UI | React 19 + Vite 8 |
| Styling | Tailwind CSS 4 |
| Local database | IndexedDB via Dexie |
| Charts | Recharts |
| Drag and drop | `@dnd-kit` |
| Reports / PDF | jsPDF + custom HTML/SVG renderers |
| PWA | `vite-plugin-pwa` |
| i18n | i18next + react-i18next |

## Development

```bash
git clone https://github.com/Grey-Matter-AS/AuraTrack.git
cd AuraTrack
npm install
npm run dev
```

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run test:i18n` | Check locale key coverage |

### Test data seeding

For report and UI stress testing, `scripts/seed-browser-db-100.js` can be pasted into the browser DevTools console while AuraTrack is open. It creates plausible randomized test data directly in the app's IndexedDB: 100 seizure events, medication schedules and dose logs, wellbeing entries, EEG diary data, and relevant settings.

The script only removes earlier records whose UUIDs start with its own `seed100-` prefix before inserting a new randomized set. It is meant for test browsers and development profiles, not real patient data.

## Documentation

- [README.md](/home/user01/Projects/AuraTrack/README.md) is the product-facing overview
- [Meta_Explainer.md](/home/user01/Projects/AuraTrack/Meta_Explainer.md) is the full technical walkthrough of the app internals, data model, flows, and implementation details

## License

AuraTrack is licensed under the GNU GPL v3.0 or later. See [LICENSE](/home/user01/Projects/AuraTrack/LICENSE).
