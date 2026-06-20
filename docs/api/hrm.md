# HRM API Reference

**Tham chiếu API quản lý nhân sự / HRM API Reference**

Complete API reference for the VietERP Human Resource Management module.

## Base URL / URL cơ sở

```
Development:  http://localhost:8000/api/v1/hrm
Production:   https://api.vierp.vn/api/v1/hrm
```

Direct module:

```
Development:  http://localhost:3003/api/v1
```

## Authentication / Xác thực

All endpoints require authentication:

```bash
Authorization: Bearer <token>
X-Tenant-ID: <tenant-id>
```

Required permissions:

- `read:hrm` - View employee data
- `write:hrm` - Create/edit records
- `manage:payroll` - Payroll operations
- `approve:leave` - Approve leave requests

## Employees / Nhân viên

### Create Employee / Tạo nhân viên

```bash
POST /hrm/employees
```

**Request:**

```json
{
  "employeeCode": "EMP-001",
  "firstName": "Nguyễn",
  "lastName": "Văn A",
  "email": "nguyen.a@company.vn",
  "phone": "+84912345678",
  "dateOfBirth": "1990-05-15",
  "gender": "male",
  "nationalId": "123456789",
  "maritalStatus": "married",
  "nationality": "Vietnamese",
  "address": {
    "street": "123 Nguyễn Huệ",
    "district": "Quận 1",
    "city": "Hồ Chí Minh",
    "postalCode": "700000",
    "country": "Vietnam"
  },
  "position": "Software Engineer",
  "department": "IT",
  "manager": "user-manager-id",
  "salary": 25000000,
  "salaryType": "monthly",
  "contractType": "permanent",
  "startDate": "2026-04-01",
  "bankAccount": {
    "accountNumber": "0123456789",
    "bankName": "Vietcombank",
    "accountHolder": "Nguyen Van A"
  },
  "taxIdentification": {
    "pid": "123456789-012",
    "insuranceNumber": "VN-1234567890"
  }
}
```

**Response (201):**

```json
{
  "data": {
    "id": "emp-123",
    "employeeCode": "EMP-001",
    "fullName": "Nguyễn Văn A",
    "email": "nguyen.a@company.vn",
    "position": "Software Engineer",
    "department": "IT",
    "status": "active",
    "salary": 25000000,
    "startDate": "2026-04-01",
    "createdAt": "2026-03-29T10:00:00Z"
  }
}
```

### List Employees / Liệt kê nhân viên

```bash
GET /hrm/employees
```

**Parameters:**

- `department` - Filter by department
- `position` - Filter by position
- `status` - active, inactive, on_leave
- `manager` - Filter by manager
- `search` - Search by name or employee code
- `sortBy` - name, startDate, salary
- `page`, `limit` - Pagination

**Example:**

```bash
curl "http://localhost:8000/api/v1/hrm/employees?department=IT&status=active"
```

### Get Employee / Lấy nhân viên

```bash
GET /hrm/employees/{employeeId}
```

### Update Employee / Cập nhật nhân viên

```bash
PUT /hrm/employees/{employeeId}
```

### Deactivate Employee / Ngừng hoạt động nhân viên

```bash
POST /hrm/employees/{employeeId}/deactivate
```

**Request:**

```json
{
  "deactivationDate": "2026-12-31",
  "reason": "retirement"
}
```

## Attendance / Chấm công

### Record Attendance / Ghi nhận chấm công

```bash
POST /hrm/attendance
```

**Request:**

```json
{
  "employeeId": "emp-123",
  "date": "2026-03-29",
  "checkIn": "08:00",
  "checkOut": "17:00",
  "status": "present",
  "notes": "Regular shift"
}
```

**Statuses:**

- `present` - Employee present
- `absent` - Employee absent
- `late` - Employee late
- `half_day` - Half day attendance
- `sick_leave` - Sick leave
- `personal_leave` - Personal leave

**Response (201):**

```json
{
  "data": {
    "id": "att-456",
    "employeeId": "emp-123",
    "date": "2026-03-29",
    "checkIn": "08:00",
    "checkOut": "17:00",
    "workedHours": 9,
    "status": "present"
  }
}
```

### Get Attendance Report / Lấy báo cáo chấm công

```bash
GET /hrm/attendance/report
```

**Parameters:**

- `employeeId` - Filter by employee (optional)
- `dateFrom`, `dateTo` - Date range
- `department` - Filter by department
- `status` - Filter by attendance status

**Response:**

```json
{
  "data": [
    {
      "employeeId": "emp-123",
      "employeeName": "Nguyễn Văn A",
      "totalDays": 20,
      "presentDays": 19,
      "absentDays": 1,
      "lateDays": 2,
      "totalWorkedHours": 171,
      "attendanceRate": 95
    }
  ]
}
```

## Leave Management / Quản lý nghỉ phép

### Get Leave Balance / Lấy số dư phép

```bash
GET /hrm/leave-balance/{employeeId}
```

**Response:**

```json
{
  "data": {
    "employeeId": "emp-123",
    "year": 2026,
    "leaveTypes": [
      {
        "type": "annual",
        "name": "Annual Leave",
        "allocated": 12,
        "used": 3,
        "remaining": 9,
        "carryover": 0
      },
      {
        "type": "sick",
        "name": "Sick Leave",
        "allocated": 12,
        "used": 1,
        "remaining": 11
      },
      {
        "type": "maternity",
        "name": "Maternity Leave",
        "allocated": 180,
        "used": 0,
        "remaining": 180
      }
    ]
  }
}
```

### Request Leave / Yêu cầu nghỉ phép

```bash
POST /hrm/leave-requests
```

**Request:**

```json
{
  "employeeId": "emp-123",
  "leaveType": "annual",
  "startDate": "2026-04-10",
  "endDate": "2026-04-15",
  "numberOfDays": 5,
  "reason": "Family trip",
  "attachments": ["s3://bucket/ticket.pdf"]
}
```

**Response (201):**

```json
{
  "data": {
    "id": "leave-789",
    "employeeId": "emp-123",
    "leaveType": "annual",
    "startDate": "2026-04-10",
    "endDate": "2026-04-15",
    "numberOfDays": 5,
    "status": "pending",
    "approver": "user-manager-id",
    "createdAt": "2026-03-29T10:00:00Z"
  }
}
```

### List Leave Requests / Liệt kê yêu cầu nghỉ phép

```bash
GET /hrm/leave-requests
```

**Parameters:**

- `employeeId` - Filter by employee
- `status` - pending, approved, rejected, cancelled
- `leaveType` - Filter by leave type
- `dateFrom`, `dateTo` - Date range

### Approve Leave Request / Phê duyệt yêu cầu nghỉ phép

```bash
POST /hrm/leave-requests/{leaveRequestId}/approve
```

**Request:**

```json
{
  "comments": "Approved"
}
```

### Reject Leave Request / Từ chối yêu cầu nghỉ phép

```bash
POST /hrm/leave-requests/{leaveRequestId}/reject
```

**Request:**

```json
{
  "reason": "Cannot approve due to project deadline"
}
```

## Payroll / Bảng lương

### Calculate Payroll / Tính bảng lương

```bash
POST /hrm/payroll/calculate
```

**Request:**

```json
{
  "payrollMonth": "2026-03",
  "employeeIds": ["emp-123", "emp-456"],
  "includeBonus": true,
  "includeAllowances": true
}
```

**Response:**

```json
{
  "data": {
    "payrollId": "payroll-2026-03",
    "month": "2026-03",
    "employees": [
      {
        "employeeId": "emp-123",
        "employeeName": "Nguyễn Văn A",
        "baseSalary": 25000000,
        "allowances": {
          "housing": 2000000,
          "transport": 1000000,
          "meal": 1500000
        },
        "totalAllowances": 4500000,
        "grossSalary": 29500000,
        "socialInsurance": 2360000,
        "healthInsurance": 235000,
        "unemployment": 235000,
        "personalDeduction": 11000000,
        "incomeTax": 2028000,
        "totalDeductions": 15858000,
        "netSalary": 13642000
      }
    ],
    "totalPayroll": 136420000,
    "status": "draft"
  }
}
```

### Approve Payroll / Phê duyệt bảng lương

```bash
POST /hrm/payroll/{payrollId}/approve
```

**Request:**

```json
{
  "approverComments": "Approved by CFO"
}
```

### Disburse Payroll / Phân phối bảng lương

```bash
POST /hrm/payroll/{payrollId}/disburse
```

Transfers salary to employee bank accounts. Creates accounting journal entries:

- Debit: Salary Expense
- Credit: Bank Account

### Get Payslip / Lấy phiếu lương

```bash
GET /hrm/payroll/{payrollId}/payslips/{employeeId}
```

**Response:**

```json
{
  "data": {
    "payrollId": "payroll-2026-03",
    "employeeId": "emp-123",
    "employeeName": "Nguyễn Văn A",
    "period": "2026-03",
    "baseSalary": 25000000,
    "earnings": {
      "baseSalary": 25000000,
      "housingAllowance": 2000000,
      "transportAllowance": 1000000,
      "mealAllowance": 1500000,
      "bonus": 500000
    },
    "totalEarnings": 30000000,
    "deductions": {
      "socialInsurance": 2360000,
      "healthInsurance": 235000,
      "unemploymentInsurance": 235000,
      "personalIncomeTax": 2028000
    },
    "totalDeductions": 15858000,
    "netSalary": 13642000,
    "bankAccount": "0123456789"
  }
}
```

## Performance Management / Quản lý hiệu suất

### Create Performance Review / Tạo đánh giá hiệu suất

```bash
POST /hrm/performance-reviews
```

**Request:**

```json
{
  "employeeId": "emp-123",
  "reviewType": "annual",
  "reviewPeriod": "2026-Q1",
  "reviewer": "user-manager-id",
  "goals": [
    {
      "description": "Complete project X",
      "weight": 40,
      "achieved": true,
      "rating": 5
    }
  ],
  "competencies": [
    {
      "name": "Technical Skills",
      "rating": 4,
      "comment": "Excellent technical capabilities"
    }
  ],
  "overallRating": 4.5,
  "comments": "Strong performer with growth potential"
}
```

### Get Performance Reviews / Lấy đánh giá hiệu suất

```bash
GET /hrm/performance-reviews/{employeeId}
```

**Parameters:**

- `reviewType` - annual, mid-year, probation
- `year` - Filter by year

## Recruitment / Tuyển dụng

### Create Job Opening / Tạo vị trí tuyển dụng

```bash
POST /hrm/job-openings
```

**Request:**

```json
{
  "position": "Senior Developer",
  "department": "IT",
  "location": "Hồ Chí Minh",
  "salaryMin": 30000000,
  "salaryMax": 50000000,
  "numberOfPositions": 2,
  "description": "We are looking for experienced developers...",
  "qualifications": ["Bachelor in CS", "3+ years experience"],
  "responsibilities": ["Code development", "Code review"],
  "isActive": true,
  "postedDate": "2026-03-29",
  "closingDate": "2026-04-30"
}
```

### List Job Openings / Liệt kê vị trí tuyển dụng

```bash
GET /hrm/job-openings
```

### Create Candidate / Tạo ứng viên

```bash
POST /hrm/candidates
```

**Request:**

```json
{
  "jobOpeningId": "job-123",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+84987654321",
  "sourceChannel": "linkedin",
  "resumeUrl": "s3://bucket/john-resume.pdf",
  "appliedDate": "2026-03-28",
  "status": "applied"
}
```

### Update Candidate Status / Cập nhật trạng thái ứng viên

```bash
PUT /hrm/candidates/{candidateId}
```

**Request:**

```json
{
  "status": "interview_scheduled",
  "interviewDate": "2026-04-05T10:00:00Z",
  "interviewer": "user-manager-id",
  "notes": "Phone interview scheduled"
}
```

## Training & Development / Đào tạo & Phát triển

### Create Training Program / Tạo chương trình đào tạo

```bash
POST /hrm/training-programs
```

**Request:**

```json
{
  "name": "Advanced TypeScript",
  "description": "Master TypeScript advanced features",
  "instructor": "tech-expert",
  "startDate": "2026-04-15",
  "endDate": "2026-04-17",
  "duration": 24,
  "durationUnit": "hours",
  "location": "Training Room A",
  "maxParticipants": 20,
  "cost": 5000000,
  "category": "technical"
}
```

### Enroll Employee in Training / Ghi danh nhân viên vào đào tạo

```bash
POST /hrm/training-enrollments
```

**Request:**

```json
{
  "trainingProgramId": "train-123",
  "employeeId": "emp-123",
  "enrollmentDate": "2026-03-29"
}
```

## Shift Management / Quản lý ca làm việc

### Create Shift / Tạo ca làm việc

```bash
POST /hrm/shifts
```

**Request:**

```json
{
  "name": "Morning Shift",
  "startTime": "08:00",
  "endTime": "17:00",
  "workingDays": ["monday", "tuesday", "wednesday", "thursday", "friday"],
  "breakDuration": 60,
  "isActive": true
}
```

### Assign Shift to Employee / Gán ca làm việc cho nhân viên

```bash
POST /hrm/shift-assignments
```

**Request:**

```json
{
  "employeeId": "emp-123",
  "shiftId": "shift-1",
  "startDate": "2026-04-01",
  "endDate": "2026-06-30"
}
```

## Overtime Management / Quản lý làm thêm

### Record Overtime / Ghi nhận làm thêm

```bash
POST /hrm/overtime
```

**Request:**

```json
{
  "employeeId": "emp-123",
  "date": "2026-03-29",
  "hours": 3,
  "reason": "Project deadline",
  "approvalStatus": "pending"
}
```

## Error Codes / Mã lỗi

| Code                         | HTTP | Description                                   |
| ---------------------------- | ---- | --------------------------------------------- |
| `EMPLOYEE_NOT_FOUND`         | 404  | Employee doesn't exist                        |
| `INSUFFICIENT_LEAVE_BALANCE` | 422  | Not enough leave balance                      |
| `LEAVE_PERIOD_OVERLAP`       | 422  | Leave dates overlap with existing request     |
| `INVALID_SALARY`             | 400  | Salary amount invalid                         |
| `PAYROLL_ALREADY_PROCESSED`  | 422  | Payroll already processed for this month      |
| `MISSING_BANK_ACCOUNT`       | 422  | Employee has no bank account for disbursement |

## Integration with Accounting / Tích hợp với kế toán

Payroll automatically creates accounting entries:

**On Payroll Disbursal:**

- Debit: Salary Expense (6211) + Insurance Expense (6212)
- Credit: Bank Account + Employee Benefits Payable

**Example:**

- Gross salary: 30,000,000 VND
- Social insurance: 2,360,000 VND
- Income tax: 2,028,000 VND
- Net salary: 13,642,000 VND

Creates journal entry:

```
Debit: Salary Expense 6211 = 30,000,000
Debit: Social Insurance Expense 6212 = 2,360,000
  Credit: Bank Account = 13,642,000
  Credit: Tax Payable = 2,028,000
  Credit: Insurance Payable = 2,360,000
  Credit: Employee Benefits = 11,690,000
```

## Next Steps / Bước tiếp theo

- Review [HRM Development Guide](../guides/module-development.md)
- Explore [Testing Guide](../guides/testing.md)
- Check [API Overview](./README.md) for patterns
