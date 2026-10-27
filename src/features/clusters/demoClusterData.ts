import type { ClusterableComplaint } from '../../services/clustering/clusterDetector';

/**
 * Made-up data so the Mass Cases screen can be shown without database rows.
 * Nothing here is saved anywhere.
 */
export function makeDemoComplaints(): ClusterableComplaint[] {
  const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  const inst = (id: string, name: string, state: string) => ({ id, name, state });
  const A = inst('demo-inst-a', 'Aryavart Institute of Technical Education', 'Rajasthan');
  const B = inst('demo-inst-b', 'Vidyapeeth College of Engineering', 'Tamil Nadu');
  const C = inst('demo-inst-c', 'Apex Institute of Pharmaceutical Sciences', 'Uttar Pradesh');

  const names = ['Riya Mehta', 'Karan Singh', 'Pooja Jain', 'Aman Verma', 'Neha Gupta', 'Rahul Yadav', 'Sneha Rao', 'Vikas Sharma', 'Anjali Das', 'Imran Khan', 'Divya Nair', 'Harsh Patel'];
  const labFee = [
    ['Extra lab development fee of Rs. 25,000', 'The college is collecting an additional lab development fee of Rs. 25,000 from every second year student. Hall ticket will be withheld if we do not pay.'],
    ['Hall ticket withheld for lab fee', 'Management said no hall ticket until we pay ₹25,000 lab development fee which is not part of the approved AICTE fee structure.'],
    ['Illegal lab charges', 'We are forced to pay 25,000 rupees as lab development charges. Students who refused were threatened with exam debarment.'],
    ['Unauthorised lab fee collection', 'Additional lab fee Rs 25,000 is being demanded in cash from all students of 2nd year, otherwise they say we cannot sit in semester exam.'],
    ['Compulsory lab development fee', 'College asked everyone to pay lab development fee of ₹25,000 within one week or the hall ticket will not be issued.'],
    ['Lab fee extortion before exams', 'Department head demanded Rs. 25,000 lab development fee from each student under threat of withholding hall tickets.'],
    ['Extra fee not in prospectus', 'The lab development fee of Rs 25,000 was never mentioned in the prospectus. Hall ticket is blocked for those who have not paid.'],
    ['Hall ticket blocked, lab fee', 'My hall ticket is not released because I did not pay the ₹25,000 lab development fee demanded by college office.'],
  ];
  const out: ClusterableComplaint[] = [];
  labFee.forEach(([title, description], i) => {
    out.push({
      id: `demo-a-${i}`,
      complaint_number: `AICTE-2026-${2001 + i}`,
      institution_id: A.id,
      title,
      description,
      category: 'Fee Cap Violation',
      status: i % 3 === 0 ? 'Under Review' : 'Received',
      received_at: day(9 - i),
      affected_count: 1,
      complainant_name: names[i],
      complainant_email: `${names[i].split(' ')[0].toLowerCase()}@example.com`,
      institution: { institution_name: A.name, state: A.state },
    });
  });

  const certs = [
    ['Original certificates not returned', 'After completing B.Tech and clearing all dues the college is refusing to return my original 10th and 12th certificates and degree.'],
    ['Certificates withheld after course', 'The institute is withholding original certificates even after no-dues clearance. They ask for extra Rs. 15,000 to release the documents.'],
    ['Not giving original documents', 'College has not returned original certificates after graduation and is demanding ₹15,000 as document release charges.'],
    ['Document release charges Rs 15,000', 'To get my original marksheets and certificates they demand 15,000 rupees which is illegal, since I already have a no dues receipt.'],
  ];
  certs.forEach(([title, description], i) => {
    out.push({
      id: `demo-b-${i}`,
      complaint_number: `AICTE-2026-${2101 + i}`,
      institution_id: B.id,
      title,
      description,
      category: 'Withholding of Original Certificates',
      status: 'Received',
      received_at: day(20 - i * 3),
      affected_count: 1,
      complainant_name: names[8 + i],
      complainant_email: `${names[8 + i].split(' ')[0].toLowerCase()}@example.com`,
      institution: { institution_name: B.name, state: B.state },
    });
  });

  // Noise: single, unrelated complaints that must NOT be grouped
  out.push(
    {
      id: 'demo-c-0', complaint_number: 'AICTE-2026-2201', institution_id: C.id, title: 'Ragging in boys hostel',
      description: 'Seniors are ragging first year students at night in hostel block B and forcing them to do tasks.',
      category: 'Ragging & Student Harassment', status: 'Received', received_at: day(4), affected_count: 1, complainant_name: 'Mohit Kumar',
      institution: { institution_name: C.name, state: C.state },
    },
    {
      id: 'demo-c-1', complaint_number: 'AICTE-2026-2202', institution_id: C.id, title: 'Faculty salary pending',
      description: 'Visiting faculty in pharmacy department have not been paid for four months.',
      category: 'Faculty Deficiency & Non-Payment of Remuneration', status: 'Under Review', received_at: day(12), affected_count: 1, complainant_name: 'Dr. S. Iyer',
      institution: { institution_name: C.name, state: C.state },
    },
    {
      id: 'demo-a-x', complaint_number: 'AICTE-2026-2203', institution_id: A.id, title: 'Library has no new books',
      description: 'Library has not purchased any new reference books for three years for the electrical department.',
      category: 'Infrastructure & Lab Non-Compliance', status: 'Received', received_at: day(6), affected_count: 1, complainant_name: 'Tanvi Shah',
      institution: { institution_name: A.name, state: A.state },
    }
  );
  return out;
}
