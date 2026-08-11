export interface Interview {
  id: string;
  candidateName: string;
  email: string;
  supportingBy: string;
  hiredBy: string;
  candidateMailAttachment: string | null; // stored filename
  interviewSnapshot: string | null;       // stored filename
  createdAt: string;                      // ISO timestamp
}

export interface DbSchema {
  interviews: Interview[];
  people: {
    supporting: string[];
    hiring: string[];
  };
}
