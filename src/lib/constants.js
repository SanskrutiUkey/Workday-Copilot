const AUTOMATION_ID_MAP = {
  'formField-legalName--firstName': 'name.first',
  'formField-legalName--middleName': 'name.middle',
  'formField-legalName--lastName': 'name.last',
  'formField-legalName--firstNameLocal': 'name.first',
  'formField-legalName--middleNameLocal': 'name.middle',
  'formField-legalName--lastNameLocal': 'name.last',
  'formField-preferredCheck': 'preferredName.usePreferred',
  'formField-preferredName--firstName': 'preferredName.first',
  'formField-preferredName--middleName': 'preferredName.middle',
  'formField-preferredName--lastName': 'preferredName.last',
  'formField-country': 'address.country',
  'formField-addressLine1': 'address.line1',
  'formField-city': 'address.city',
  'formField-postalCode': 'address.postalCode',
  'formField-countryRegion': 'address.state',
  'formField-phoneType': 'phone.type',
  'formField-countryPhoneCode': 'phone.countryCode',
  'formField-phoneNumber': 'phone.number',
  'formField-extension': 'phone.extension',
  'formField-emailAddress': 'email',
  'formField-source': 'meta.source',
  'formField-candidateIsPreviousWorker': 'meta.previousWorker',
  'formField-jobTitle': 'experience[0].jobTitle',
  'formField-companyName': 'experience[0].company',
  'formField-currentlyWorkHere': 'experience[0].current',
  'formField-startDate': 'experience[0].startDate',
  'formField-roleDescription': 'experience[0].description',
  'formField-endDate': 'experience[0].endDate',
  'formField-schoolName': 'education[0].school',
  'formField-degree': 'education[0].degree',
  'formField-fieldOfStudy': 'education[0].fieldOfStudy',
  'formField-skills': 'skills',
  'formField-gender': 'meta.eeo.gender',
  'formField-ethnicity': 'meta.eeo.ethnicity',
  'formField-hispanicOrLatino': 'meta.eeo.hispanicOrLatino',
  'formField-acceptTermsAndAgreements': 'meta.acceptTerms'
};

const REPEATABLE_FIELD_MAP = {
  experience: {
    'formField-jobTitle': 'jobTitle',
    'formField-companyName': 'company',
    'formField-currentlyWorkHere': 'current',
    'formField-startDate': 'startDate',
    'formField-endDate': 'endDate',
    'formField-roleDescription': 'description'
  },
  education: {
    'formField-schoolName': 'school',
    'formField-degree': 'degree',
    'formField-fieldOfStudy': 'fieldOfStudy',
    'formField-startDate': 'startDate',
    'formField-endDate': 'endDate'
  }
};

const SYNONYMS = {
  'given name': 'name.first',
  'first name': 'name.first',
  'forename': 'name.first',
  'surname': 'name.last',
  'family name': 'name.last',
  'last name': 'name.last',
  'middle name': 'name.middle',
  'mobile': 'phone.number',
  'telephone': 'phone.number',
  'phone number': 'phone.number',
  'cell': 'phone.number',
  'phone device type': 'phone.type',
  'country phone code': 'phone.countryCode',
  'zip': 'address.postalCode',
  'zipcode': 'address.postalCode',
  'zip code': 'address.postalCode',
  'postal code': 'address.postalCode',
  'address line 1': 'address.line1',
  'street address': 'address.line1',
  'address line 2': 'address.line2',
  'city': 'address.city',
  'state': 'address.state',
  'province': 'address.state',
  'country': 'address.country',
  'email': 'email',
  'email address': 'email',
  'job title': 'experience[0].jobTitle',
  'position': 'experience[0].jobTitle',
  'company': 'experience[0].company',
  'company name': 'experience[0].company',
  'employer': 'experience[0].company',
  'school': 'education[0].school',
  'school name': 'education[0].school',
  'university': 'education[0].school',
  'degree': 'education[0].degree',
  'field of study': 'education[0].fieldOfStudy',
  'major': 'education[0].fieldOfStudy',
  'skills': 'skills',
  'start date': 'experience[0].startDate',
  'from date': 'experience[0].startDate',
  'currently work here': 'experience[0].current',
  'role description': 'experience[0].description',
  'how did you hear': 'meta.source',
  'previously worked': 'meta.previousWorker',
  'former employee': 'meta.previousWorker',
  'gender': 'meta.eeo.gender',
  'race': 'meta.eeo.ethnicity',
  'ethnicity': 'meta.eeo.ethnicity',
  'hispanic': 'meta.eeo.hispanicOrLatino',
  'terms and conditions': 'meta.acceptTerms',
  'accept terms': 'meta.acceptTerms'
};

const EEO_DECLINE = [
  "I don't wish to answer",
  "I do not want to answer",
  "I don't want to answer",
  'Prefer not to answer',
  'Decline to answer',
  'I do not wish to answer'
];

const STEP_IDS = {
  MY_INFO: 'applyFlowMyInfoPage',
  MY_EXP: 'applyFlowMyExpPage',
  QUESTIONS: 'applyFlowPrimaryQuestionsPage',
  VOLUNTARY: 'applyFlowVoluntaryDisclosuresPage',
  REVIEW: 'applyFlowReviewPage'
};

const STEP_ORDER = [
  STEP_IDS.MY_INFO,
  STEP_IDS.MY_EXP,
  STEP_IDS.QUESTIONS,
  STEP_IDS.VOLUNTARY,
  STEP_IDS.REVIEW
];

export {
  AUTOMATION_ID_MAP,
  REPEATABLE_FIELD_MAP,
  SYNONYMS,
  EEO_DECLINE,
  STEP_IDS,
  STEP_ORDER
};
