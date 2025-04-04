// Employees Collection Indexes
db.employees.createIndex({ "personalInfo.email": 1 }, { unique: true });
db.employees.createIndex({ "employmentInfo.department": 1 });
db.employees.createIndex({ "employmentInfo.managerId": 1 });
db.employees.createIndex({ "employmentInfo.status": 1 });

// Payroll Collection Indexes
db.payroll.createIndex({ employeeId: 1, month: 1 }, { unique: true });
db.payroll.createIndex({ employeeId: 1, year: 1 });
db.payroll.createIndex({ status: 1 });
db.payroll.createIndex({ paymentDate: 1 });

// Performance Reviews Collection Indexes
db.performance_reviews.createIndex({ employeeId: 1, "reviewPeriod.start": -1 });
db.performance_reviews.createIndex({ reviewerId: 1 });
db.performance_reviews.createIndex({ status: 1 });
db.performance_reviews.createIndex({ "goals.dueDate": 1 });

// Attendance History Collection Indexes
db.attendance_history.createIndex({ employeeId: 1, date: -1 });
db.attendance_history.createIndex({ date: -1 });
db.attendance_history.createIndex({ status: 1 });

// Compound Indexes for Common Queries
db.employees.createIndex({ 
  "employmentInfo.department": 1, 
  "employmentInfo.status": 1 
});

db.payroll.createIndex({ 
  employeeId: 1, 
  year: 1, 
  month: 1, 
  status: 1 
});

db.attendance_history.createIndex({ 
  employeeId: 1, 
  date: -1, 
  status: 1 
});

// Text Indexes for Search
db.employees.createIndex({ 
  "personalInfo.firstName": "text", 
  "personalInfo.lastName": "text", 
  "employmentInfo.position": "text" 
});

// TTL Indexes for Data Cleanup
db.activity_logs.createIndex({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // 30 days 