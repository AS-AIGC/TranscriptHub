package main

import(
   "os"
   "fmt"
   "io/ioutil"
   "encoding/json"
   "github.com/asccclass/sherrytime"
)

type Job struct {
   TaskID	string		`json:"taskID"`
   Owner	string		`json:"owner"`
   FileName	string		`json:"fileName"`
   Action	string		`json:"action"`
   Status	string		`json:"status"`
   UploadTime	string		`json:"uploadTime"`
   FinishTime	string		`json:"finishTime"`
   MultipleTag	string		`json:"multipleTag"`		// 是否標註不同人發言？ 0)關閉  1)開啟
   Results	[]string	`json:"results"`		// 處理結果
}

// 儲存工作
func SaveJobs(jobs []Job)(error) {
   filepath := os.Getenv("UploadFolder") + os.Getenv("JobsFile")
   updatedJSON, err := json.MarshalIndent(jobs, "", "    ")
   if err != nil {
      return err
   }
   // 假設不會同時間有開啟同檔案（日後要改進）
   // if err := writeWithFileLock(filepath, updatedJSON); err != nil {
   if err := ioutil.WriteFile(filepath, updatedJSON, 0644); err != nil {
      return err
   }
   NeedSave = false
   return nil
}

// 取得所有 jobs
func GetAllJobs()([]Job, error) {
   if len(Joblistz) > 0  {
      return Joblistz , nil
   }
   var jobs []Job
   filename := os.Getenv("UploadFolder") + os.Getenv("JobsFile")   // tmp/joblists
   jsonData, err := ioutil.ReadFile(filename)
   if err != nil {
      return jobs, err
   }
   if err = json.Unmarshal(jsonData, &jobs); err != nil {
      return jobs, err
   }
   fmt.Println("read " + filename)
   return jobs, nil
}

// 讀取自己的工作列表
func ReadJobsViaEmail(email string)([]Job, error) {
   var jobs []Job
   var rjob []Job
   jobs, err := GetAllJobs()
   if err != nil {
      return jobs, err
   }
   for _, job := range jobs {
      if job.Owner == email {
         rjob = append(rjob, job)
      }
   }
   return rjob, err
}

// 讀取特定工作列表
func ReadJobsViaTaskID(taskID string)(Job, error) {
   var jobs []Job
   var rjob Job
   jobs, err := GetAllJobs()
   if err != nil {
      return rjob, err
   }
   for _, job := range jobs {
      if job.TaskID == taskID {
         return job, nil
      }
   }
   return rjob, fmt.Errorf("not found")
}

/*
finish: '10',    <--轉檔完成
  pending: '5', <---建好objid後
  canceled: '1'
  error: '0'
*/

// 更新 jobs 狀態（翻譯完成，觸發）
func UpdateJobsViaTaskID(msg ReturnMessage)(error) {
   foundz := false
   for idx, job := range Joblistz {
      if job.TaskID == msg.TaskID {
         st := sherrytime.NewSherryTime("Asia/Taipei", "-")  // Initial
         Joblistz[idx].Results = msg.Results
         Joblistz[idx].FinishTime = st.Now()
         if msg.Status == 10 {
            Joblistz[idx].Status = "Done"
            NeedSave = true
         } else if msg.Status == 5 {
            Joblistz[idx].Status = "Queue"
            NeedSave = true
         } else if msg.Status == 1 {
            Joblistz[idx].Status = "Canceled"
         } else if msg.Status == 0 {
            Joblistz[idx].Status = "Error"
         }
         if NeedSave {
            go SendEmailNotify(msg.TaskID, msg.Status)
         }
         foundz = true
         break
      }
   }
   if !foundz {
      return fmt.Errorf("No job id:" + msg.TaskID)
   }
   return nil
}

// 更新 jobs 狀態（檔案上傳觸發）
func UpdateJobs(sso, filename, uuid string, msg ReturnMessage)(error) {
   for i, job := range Joblistz {
      if job.Owner == sso && job.FileName == filename && job.TaskID == uuid {
         Joblistz[i].TaskID = msg.TaskID
	 Joblistz[i].Status = "pending"
	 NeedSave = true
	 break
      }
   }
   fmt.Println("update jobs file ok")
   return nil
}

func ReadJobsViaEmailandFile(email, fileName string)(Job, error) {
   var jo Job
   for i, job := range Joblistz {
      if job.FileName == fileName {
         return Joblistz[i], nil
      }
   }
   return jo, fmt.Errorf(fileName + " not found")
}