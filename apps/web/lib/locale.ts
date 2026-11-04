import { formatLocaleDate, type AppLocale } from "@edu/shared";

const STORAGE_KEY = "edu_locale";

export function getAppLocale(): AppLocale {
  if (typeof window === "undefined") return "en";
  return localStorage.getItem(STORAGE_KEY) === "ne" ? "ne" : "en";
}

export function setAppLocale(locale: AppLocale) {
  localStorage.setItem(STORAGE_KEY, locale);
  window.location.reload();
}

const NEPALI_TRANSLATIONS: Record<string, string> = {
  Workspace: "कार्यस्थान",
  Overview: "अवलोकन",
  People: "व्यक्ति",
  Students: "विद्यार्थी",
  "Parents & guardians": "अभिभावकहरू",
  "Staff profiles": "कर्मचारी विवरण",
  "User management": "प्रयोगकर्ता व्यवस्थापन",
  Academics: "शैक्षिक",
  Attendance: "हाजिरी",
  "Leave requests": "बिदा अनुरोध",
  Learning: "सिकाइ",
  "Exams & results": "परीक्षा र नतिजा",
  Reports: "प्रतिवेदन",
  Finance: "वित्त",
  "Fees & invoices": "शुल्क र बिल",
  "Payment settings": "भुक्तानी सेटिङ",
  Community: "समुदाय",
  "Community updates": "समुदाय अपडेट",
  "Community messaging": "समुदाय सन्देश",
  "Share announcements, send targeted broadcasts, and keep the school calendar in one place.": "घोषणा साझा गर्नुहोस्, लक्षित सूचना पठाउनुहोस् र विद्यालय क्यालेन्डर एउटै स्थानमा राख्नुहोस्।",
  "Notices & events": "सूचना र कार्यक्रम",
  Settings: "सेटिङ",
  Branding: "ब्रान्डिङ",
  "Email settings": "इमेल सेटिङ",
  "Document templates": "कागजात नमुना",
  Notices: "सूचनाहरू",
  Events: "कार्यक्रमहरू",
  "Bulk message": "सामूहिक सन्देश",
  "Send a targeted broadcast": "लक्षित सूचना पठाउनुहोस्",
  "Email subject": "इमेल विषय",
  Message: "सन्देश",
  "Write your message": "तपाईंको सन्देश लेख्नुहोस्",
  Audience: "प्रापक समूह",
  everyone: "सबै",
  students: "विद्यार्थी",
  parents: "अभिभावक",
  teachers: "शिक्षक",
  staff: "कर्मचारी",
  "Send broadcast": "सूचना पठाउनुहोस्",
  "Publish a notice": "सूचना प्रकाशित गर्नुहोस्",
  "Notice title": "सूचना शीर्षक",
  "Notice message": "सूचना सन्देश",
  Priority: "प्राथमिकता",
  "Publish notice": "सूचना प्रकाशित गर्नुहोस्",
  "Add a calendar event": "क्यालेन्डर कार्यक्रम थप्नुहोस्",
  "Event title": "कार्यक्रम शीर्षक",
  "Calendar type": "क्यालेन्डर प्रकार",
  Description: "विवरण",
  "Start date": "सुरु मिति",
  "End date": "अन्त्य मिति",
  "Start time": "सुरु समय",
  "End time": "अन्त्य समय",
  Venue: "स्थान",
  "Add event": "कार्यक्रम थप्नुहोस्",
  "No notices have been published yet.": "अहिलेसम्म कुनै सूचना प्रकाशित गरिएको छैन।",
  "No events are scheduled yet.": "अहिलेसम्म कुनै कार्यक्रम तय गरिएको छैन।",
  "Use the composer above to send a targeted school broadcast.": "लक्षित विद्यालय सूचना पठाउन माथिको फारम प्रयोग गर्नुहोस्।",
  "Loading updates…": "अपडेटहरू लोड हुँदैछन्…",
  Institution: "संस्था",
  "Change password": "पासवर्ड परिवर्तन",
  "Sign out": "साइन आउट",
  Language: "भाषा",
  "Account menu": "खाता मेनु",
  Retry: "पुनः प्रयास",
  "Online gateways": "अनलाइन गेटवे",
  "Manual payments": "म्यानुअल भुक्तानी",
  "Finance configuration": "वित्तीय कन्फिगरेसन",
  "Connect gateways, publish manual payment instructions, and control family fee access.":
    "भुक्तानी गेटवे जोड्नुहोस्, म्यानुअल भुक्तानी निर्देशन प्रकाशित गर्नुहोस् र परिवारको शुल्क पहुँच नियन्त्रण गर्नुहोस्।",
};

export function translate(value: string, locale: AppLocale = getAppLocale()) {
  return locale === "ne" ? NEPALI_TRANSLATIONS[value] ?? value : value;
}

export function formatAppDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  return formatLocaleDate(value, getAppLocale(), options);
}
