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
  { key: "familyRole", label: "Family Role" },
];

// Apply filters to members
const applyFilters = (members, filters) => {
  let result = [...members];

  // Tag filter
  if (filters.tags && filters.tags.length > 0) {
    result = result.filter((member) => {
      if (!member.tags || !Array.isArray(member.tags)) return false;
      return filters.tags.some((tag) => member.tags.includes(tag));
    });
  }

  // Member status filter
  if (filters.isMember !== null && filters.isMember !== undefined) {
    result = result.filter((member) => member.isMember === filters.isMember);
  }

  // Sex filter
  if (filters.sex) {
    result = result.filter((member) => member.sex === filters.sex);
  }

  // Civil status filter
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

// Convert member to CSV row
const memberToCSVRow = (member, fields) => {
  const row = [];
  
  availableFields.forEach((field) => {
    if (fields[field.key]) {
      let value = member[field.key];
      
      // Handle special cases
      if (field.key === "tags" && Array.isArray(value)) {
        value = value.join(", ");
      }
      if (field.key === "isMember") {
        value = value ? "Yes" : "No";
      }
      if (value === null || value === undefined) {
        value = "";
      }
      
      // Escape commas and quotes in CSV
      const stringValue = String(value);
      if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
        row.push(`"${stringValue.replace(/"/g, '""')}"`);
      } else {
        row.push(stringValue);
      }
    }
  });
  
  return row.join(",");
};

// Export members to CSV
export const exportToCSV = (members, config) => {
  // Apply filters
  let dataToExport = config.useCurrentFilters
    ? applyFilters(members, config.filters)
    : members;

  // Apply sorting
  dataToExport = sortMembers(dataToExport, config.sortBy, config.sortOrder);

  // Generate CSV header
  const headers = availableFields
    .filter((field) => config.fields[field.key])
    .map((field) => field.label);

  // Generate CSV rows
  const rows = dataToExport.map((member) => memberToCSVRow(member, config.fields));

  // Combine header and rows
  const csvContent = [headers.join(","), ...rows].join("\n");

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `members_export_${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

