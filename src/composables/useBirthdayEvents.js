import { computed } from 'vue';
import { getFullName } from '../utils/memberUtils';

export function useBirthdayEvents(members, firestoreEvents = { value: [] }) {
  // Generate birthday events for current year from members
  const birthdayEvents = computed(() => {
    if (!members.value || members.value.length === 0) return [];

    const currentYear = new Date().getFullYear();
    const events = [];

    // Get dates that have override events (real Firestore events with overrideOf field)
    const overriddenDates = new Set(
      firestoreEvents.value
        .filter(e => e.overrideOf?.startsWith('birthday-'))
        .map(e => e.date)
    );

    members.value.forEach((member) => {
      if (!member.dateOfBirth) return;

      // Parse date parts directly to avoid timezone issues
      const [year, month, day] = member.dateOfBirth.split('-').map(Number);
      if (!year || !month || !day) return;

      const dateString = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const virtualId = `birthday-${member.firestoreId || member.id}-${currentYear}`;

      // Skip if there's an override for this specific virtual event
      const hasOverride = firestoreEvents.value.some(e => e.overrideOf === virtualId);
      if (hasOverride) return;

      // Calculate age they'll turn this year
      const turningAge = currentYear - year;

      const fullName = getFullName(member);
      const displayName = member.nickname || member.firstName;

      events.push({
        id: virtualId,
        firestoreId: null, // Virtual event, not in Firestore
        title: `${displayName}'s Birthday`,
        type: 'celebration',
        date: dateString,
        time: '06:00',
        location: '',
        description: `${fullName} turns ${turningAge} years old!`,
        attendees: 0,
        icon: 'Cake',
        // Birthday-specific fields
        isBirthday: true,
        isVirtual: true,
        memberId: member.firestoreId || member.id,
        memberName: displayName,
        turningAge,
      });
    });

    return events;
  });

  // Get birthdays for a specific month
  const getBirthdaysForMonth = (year, month) => {
    return birthdayEvents.value.filter((event) => {
      const eventDate = new Date(event.date);
      return eventDate.getFullYear() === year && eventDate.getMonth() === month;
    });
  };

  // Get upcoming birthdays (next N days)
  const getUpcomingBirthdays = (days = 30) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);

    return birthdayEvents.value
      .filter((event) => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today && eventDate <= endDate;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // Get today's birthdays
  const todaysBirthdays = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return birthdayEvents.value.filter((event) => event.date === today);
  });

  return {
    birthdayEvents,
    getBirthdaysForMonth,
    getUpcomingBirthdays,
    todaysBirthdays,
  };
}
