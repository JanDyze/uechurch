// Labels for the Small Group session form, in the two languages the report is
// actually filled out in. This is deliberately a flat per-feature dictionary
// rather than an app-wide i18n layer: only this form is bilingual, and the
// printed sheet has to match whichever language the leader is writing in.

export const SG_LANGUAGES = [
  { code: 'en', short: 'ENG', label: 'English' },
  { code: 'tl', short: 'TAG', label: 'Tagalog' },
]

export const SG_LABELS = {
  en: {
    // Feature / navigation
    smallGroups: 'Small Groups',
    smallGroup: 'Small Group',
    group: 'Group',
    groupName: 'Group Name',
    description: 'Description',
    roster: 'Members',
    members: 'Members',
    sessions: 'Sessions',
    lastMet: 'Last Met',
    session: 'Session',
    sessionReport: 'Small Group Session Report',
    meetingDay: 'Meeting Day',
    meetingTime: 'Meeting Time',
    location: 'Location',
    active: 'Active',
    inactive: 'Inactive',

    // Session details
    date: 'Date',
    startTime: 'Start Time',
    endTime: 'End Time',
    venue: 'Venue',
    leader: 'Leader',
    coLeaders: 'Co-Leaders',

    // Lesson
    lesson: 'Lesson',
    lessonTitle: 'Lesson / Topic',
    scripture: 'Scripture Passage',
    discussionNotes: 'Discussion Notes',
    takeaways: 'Key Takeaways',

    // Attendance
    attendance: 'Attendance',
    present: 'Present',
    absent: 'Absent',
    guests: 'Guests / Visitors',
    guestName: 'Name',
    guestContact: 'Contact',
    invitedBy: 'Invited By',
    addGuest: 'Add Guest',
    markAll: 'Mark all present',
    clearAll: 'Clear all',
    totalPresent: 'Total Present',
    totalGuests: 'Total Guests',
    totalAttendance: 'Total Attendance',


    // Prayer
    prayerRequests: 'Prayer Requests',
    addPrayerRequest: 'Add Prayer Request',
    requestedBy: 'Requested By',

    // Misc
    photos: 'Photos',
    coverPhoto: 'Cover Photo',
    changePhoto: 'Change',
    removePhoto: 'Remove',
    adjustPhoto: 'Adjust Cover Photo',
    adjustPhotoHint: 'Drag to reposition, pinch or use the slider to zoom.',
    notes: 'Notes',
    recordedBy: 'Recorded By',
    signature: 'Signature',
    total: 'Total',
    none: 'None',

    // Actions
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    print: 'Print',
    printBlank: 'Print Blank Form',
    export: 'Export to Excel',
    search: 'Search',
    newSession: 'New Session',
    newGroup: 'New Group',

    // Empty states
    noGroups: 'No small groups yet.',
    noSessions: 'No sessions recorded yet.',
    noMembers: 'No members assigned yet.',

    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },

  tl: {
    smallGroups: 'Small Groups',
    smallGroup: 'Small Group',
    group: 'Grupo',
    groupName: 'Pangalan ng Grupo',
    description: 'Paglalarawan',
    roster: 'Mga Miyembro',
    members: 'Mga Miyembro',
    sessions: 'Mga Sesyon',
    lastMet: 'Huling Pagkikita',
    session: 'Sesyon',
    sessionReport: 'Ulat ng Sesyon ng Maliit na Grupo',
    meetingDay: 'Araw ng Pagtitipon',
    meetingTime: 'Oras ng Pagtitipon',
    location: 'Lokasyon',
    active: 'Aktibo',
    inactive: 'Hindi Aktibo',

    date: 'Petsa',
    startTime: 'Oras ng Simula',
    endTime: 'Oras ng Pagtatapos',
    venue: 'Lugar',
    leader: 'Lider',
    coLeaders: 'Katuwang na Lider',

    lesson: 'Aralin',
    lessonTitle: 'Aralin / Paksa',
    scripture: 'Talata sa Biblia',
    discussionNotes: 'Mga Tala sa Talakayan',
    takeaways: 'Mahahalagang Natutunan',

    attendance: 'Pagdalo',
    present: 'Dumalo',
    absent: 'Lumiban',
    guests: 'Mga Bisita',
    guestName: 'Pangalan',
    guestContact: 'Kontak',
    invitedBy: 'Inanyayahan ni',
    addGuest: 'Magdagdag ng Bisita',
    markAll: 'Lahat ay dumalo',
    clearAll: 'Alisin lahat',
    totalPresent: 'Kabuuang Dumalo',
    totalGuests: 'Kabuuang Bisita',
    totalAttendance: 'Kabuuang Pagdalo',


    prayerRequests: 'Mga Kahilingan sa Panalangin',
    addPrayerRequest: 'Magdagdag ng Kahilingan',
    requestedBy: 'Humiling',

    photos: 'Mga Larawan',
    coverPhoto: 'Larawan ng Grupo',
    changePhoto: 'Palitan',
    removePhoto: 'Alisin',
    adjustPhoto: 'Ayusin ang Larawan',
    adjustPhotoHint: 'I-drag para ilipat, mag-pinch o gamitin ang slider para mag-zoom.',
    notes: 'Mga Tala',
    recordedBy: 'Itinala ni',
    signature: 'Lagda',
    total: 'Kabuuan',
    none: 'Wala',

    save: 'I-save',
    cancel: 'Kanselahin',
    delete: 'Burahin',
    edit: 'Baguhin',
    add: 'Magdagdag',
    print: 'I-print',
    printBlank: 'I-print na Blangko',
    export: 'I-export sa Excel',
    search: 'Maghanap',
    newSession: 'Bagong Sesyon',
    newGroup: 'Bagong Grupo',

    noGroups: 'Wala pang maliit na grupo.',
    noSessions: 'Wala pang naitalang sesyon.',
    noMembers: 'Wala pang nakatalagang miyembro.',

    weekdays: ['Linggo', 'Lunes', 'Martes', 'Miyerkules', 'Huwebes', 'Biyernes', 'Sabado'],
  },
}

/** Falls back to English, then to the key itself, so a missing label is visible
 *  but never blanks out the form. */
export const sgLabel = (lang, key) => {
  const dict = SG_LABELS[lang] || SG_LABELS.en
  return dict[key] ?? SG_LABELS.en[key] ?? key
}
