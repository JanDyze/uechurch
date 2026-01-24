import XLSX from 'xlsx-js-style';

// Available fields for export
const availableFields = [
  { key: "id", label: "ID" },
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "nickname", label: "Nickname" },
  { key: "sex", label: "Gender" },
  { key: "dateOfBirth", label: "Date of Birth" },
  { key: "age", label: "Age" },
  { key: "civilStatus", label: "Civil Status" },
  { key: "address", label: "Address" },
  { key: "contactNumber", label: "Contact Number" },
  { key: "occupation", label: "Occupation" },
  { key: "tags", label: "Tags" },
  { key: "isMember", label: "Is Member" },
];

// Cell styles
const styles = {
  // Header style - dark blue background with white text
  header: {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
    fill: { fgColor: { rgb: "01779B" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "01779B" } },
      bottom: { style: "thin", color: { rgb: "01779B" } },
      left: { style: "thin", color: { rgb: "01779B" } },
      right: { style: "thin", color: { rgb: "01779B" } },
    },
  },
  // Title style
  title: {
    font: { bold: true, color: { rgb: "01779B" }, sz: 16 },
    alignment: { horizontal: "center", vertical: "center" },
  },
  // Subtitle style
  subtitle: {
    font: { color: { rgb: "666666" }, sz: 10, italic: true },
    alignment: { horizontal: "center", vertical: "center" },
  },
  // Data cell - even row
  dataEven: {
    font: { sz: 10 },
    fill: { fgColor: { rgb: "F8FAFC" } },
    alignment: { vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } },
    },
  },
  // Data cell - odd row
  dataOdd: {
    font: { sz: 10 },
    fill: { fgColor: { rgb: "FFFFFF" } },
    alignment: { vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } },
    },
  },
  // Member status - Yes
  memberYes: {
    font: { sz: 10, bold: true, color: { rgb: "166534" } },
    fill: { fgColor: { rgb: "DCFCE7" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } },
    },
  },
  // Member status - No
  memberNo: {
    font: { sz: 10, color: { rgb: "6B7280" } },
    fill: { fgColor: { rgb: "F3F4F6" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } },
    },
  },
  // Gender Male
  genderMale: {
    font: { sz: 10, color: { rgb: "1D4ED8" } },
    fill: { fgColor: { rgb: "DBEAFE" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } },
    },
  },
  // Gender Female
  genderFemale: {
    font: { sz: 10, color: { rgb: "DB2777" } },
    fill: { fgColor: { rgb: "FCE7F3" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } },
    },
  },
  // Age cell
  ageCell: {
    font: { sz: 10 },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "E2E8F0" } },
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      left: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "E2E8F0" } },
    },
  },
};

// Apply filters to members
const applyFilters = (members, filters) => {
  let result = [...members];

  if (filters.tags && filters.tags.length > 0) {
    result = result.filter((member) => {
      if (!member.tags || !Array.isArray(member.tags)) return false;
      return filters.tags.some((tag) => member.tags.includes(tag));
    });
  }

  if (filters.isMember !== null && filters.isMember !== undefined) {
    result = result.filter((member) => member.isMember === filters.isMember);
  }

  if (filters.sex) {
    result = result.filter((member) => member.sex === filters.sex);
  }

  if (filters.civilStatus) {
    result = result.filter((member) => member.civilStatus === filters.civilStatus);
  }

  return result;
};

// Sort members
const sortMembers = (members, sortBy, sortOrder) => {
  const sorted = [...members];

  sorted.sort((a, b) => {
    let aVal, bVal;

    switch (sortBy) {
      case "name":
        aVal = `${a.firstName || ''} ${a.lastName || ''}`.toLowerCase();
        bVal = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase();
        break;
      case "age":
        aVal = a.age || 0;
        bVal = b.age || 0;
        break;
      case "dateOfBirth":
        aVal = a.dateOfBirth || "";
        bVal = b.dateOfBirth || "";
        break;
      default:
        aVal = a[sortBy] || "";
        bVal = b[sortBy] || "";
    }

    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  return sorted;
};

// Get cell style based on value and field
const getCellStyle = (fieldKey, value, rowIndex) => {
  const isEven = rowIndex % 2 === 0;
  const baseStyle = isEven ? styles.dataEven : styles.dataOdd;

  if (fieldKey === "isMember") {
    return value === "Yes" ? styles.memberYes : styles.memberNo;
  }
  
  if (fieldKey === "sex") {
    if (value === "Male") return styles.genderMale;
    if (value === "Female") return styles.genderFemale;
  }
  
  if (fieldKey === "age") {
    return { ...baseStyle, ...styles.ageCell, fill: baseStyle.fill };
  }

  return baseStyle;
};

// Export members to Excel (.xlsx) with styling
export const exportToExcel = (members, config) => {
  // Apply filters
  let dataToExport = config.useCurrentFilters
    ? applyFilters(members, config.filters)
    : members;

  // Apply sorting
  dataToExport = sortMembers(dataToExport, config.sortBy, config.sortOrder);

  // Get selected headers
  const headers = availableFields
    .filter((field) => config.fields[field.key])
    .map((field) => field.label);

  const headerKeys = availableFields
    .filter((field) => config.fields[field.key])
    .map((field) => field.key);

  // Create worksheet data with title rows
  const wsData = [];
  
  // Title row
  wsData.push([`UEC Canubing II - Members Directory`]);
  
  // Subtitle row
  const exportDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  wsData.push([`Exported on ${exportDate} • ${dataToExport.length} members`]);
  
  // Empty row
  wsData.push([]);
  
  // Header row
  wsData.push(headers);
  
  // Data rows
  dataToExport.forEach((member) => {
    const row = headerKeys.map((key) => {
      let value = member[key];
      
      if (key === "tags" && Array.isArray(value)) {
        value = value.join(", ");
      }
      if (key === "isMember") {
        value = value ? "Yes" : "No";
      }
      if (value === null || value === undefined) {
        value = "";
      }
      
      return value;
    });
    wsData.push(row);
  });

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Merge title cells
  const colCount = headers.length;
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }, // Title
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } }, // Subtitle
  ];

  // Apply styles
  const range = XLSX.utils.decode_range(ws['!ref']);
  
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      
      if (!ws[cellRef]) {
        ws[cellRef] = { v: '', t: 's' };
      }
      
      // Title row
      if (R === 0) {
        ws[cellRef].s = styles.title;
      }
      // Subtitle row
      else if (R === 1) {
        ws[cellRef].s = styles.subtitle;
      }
      // Empty row
      else if (R === 2) {
        // Skip
      }
      // Header row
      else if (R === 3) {
        ws[cellRef].s = styles.header;
      }
      // Data rows
      else if (R > 3) {
        const fieldKey = headerKeys[C];
        const cellValue = ws[cellRef].v;
        ws[cellRef].s = getCellStyle(fieldKey, cellValue, R - 4);
      }
    }
  }

  // Set column widths
  const colWidths = headers.map((header, idx) => {
    const key = headerKeys[idx];
    // Different widths based on field type
    if (key === 'address') return { wch: 35 };
    if (key === 'tags') return { wch: 25 };
    if (key === 'firstName' || key === 'lastName') return { wch: 15 };
    if (key === 'nickname') return { wch: 12 };
    if (key === 'dateOfBirth') return { wch: 14 };
    if (key === 'contactNumber') return { wch: 15 };
    if (key === 'occupation') return { wch: 18 };
    if (key === 'age' || key === 'id') return { wch: 8 };
    if (key === 'sex' || key === 'isMember') return { wch: 10 };
    if (key === 'civilStatus') return { wch: 12 };
    return { wch: Math.max(header.length + 4, 12) };
  });
  ws['!cols'] = colWidths;

  // Set row heights
  ws['!rows'] = [
    { hpt: 30 }, // Title row
    { hpt: 20 }, // Subtitle row
    { hpt: 10 }, // Empty row
    { hpt: 25 }, // Header row
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Members');

  // Generate filename
  const filename = `UEC_Members_${new Date().toISOString().split("T")[0]}.xlsx`;

  // Download
  XLSX.writeFile(wb, filename);
};

// Legacy export (kept for compatibility)
export const exportToCSV = (members, config) => {
  exportToExcel(members, config);
};
