<!DOCTYPE html>
<html lang="en">
   <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href='https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css' rel='stylesheet'>
      <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
      <link rel="stylesheet" href="/css/xx.css">
      <title>Transcription (Beta Version)</title>
      <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
           font-family: Arial, sans-serif;
        }

        /* 側邊欄樣式 */
        .sidebar {
            width: 250px;
            height: 100vh;
            background: #f8f9fa;
            position: fixed;
            left: 0;
            top: 0;
            transition: 0.3s;
            border-right: 1px solid #ddd;
            padding-top: 20px;
        }

        .sidebar.collapsed {
            width: 60px;
        }

        .sidebar-header {
            padding: 0 20px 20px 20px;
            border-bottom: 1px solid #ddd;
            display: flex;
            align-items: center;
        }

        .sidebar-header h1 {
            font-size: 20px;
            color: #333;
        }

        .toggle-btn {
            position: absolute;
            right: -12px;
            top: 50px;
            background: white;
            border: 1px solid #ddd;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        }

        .nav-menu {
            list-style: none;
            padding: 20px 0;
        }

        .nav-item {
            padding: 10px 20px;
            display: flex;
            align-items: center;
            cursor: pointer;
            color: #666;
            text-decoration: none;
        }

        .nav-item:hover {
            background: #e9ecef;
        }

        .nav-item.active {
            color: #ff69b4;
        }

        .nav-item i {
            margin-right: 15px;
            width: 20px;
            text-align: center;
        }

        .nav-text {
            white-space: nowrap;
            overflow: hidden;
        }
        .right-align {
            margin-left: auto;
            margin-right: 0;
            width: fit-content;
        }

        /* 主內容區域樣式 */
        .main-content {
            margin-left: 250px;
            padding: 20px;
            transition: 0.3s;
        }

        .main-content.expanded {
            margin-left: 60px;
        }
        .highlight {
           background-color: yellow;
           transition: background-color 2s ease-out;
        }
        .highlight {
           background-color: yellow;
           transition: background-color 2s ease-out;
        }

        /* RWD 調整 */
        @media screen and (max-width: 768px) {
            .sidebar {
                width: 60px;
            }

            .sidebar.expanded {
                width: 250px;
            }

            .main-content {
                margin-left: 60px;
            }

            .main-content.collapsed {
                margin-left: 250px;
            }

            .nav-text {
                opacity: 0;
                display: none;
            }

            .sidebar.expanded .nav-text {
                opacity: 1;
                display: inline;
            }
        }

        /* 原有的表格和表單樣式 */
        .container {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .responsive-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            max-width: 1200px;
        }
        
        .responsive-table th,
        .responsive-table td {
            padding: 12px;
            text-align: left;
            border: 1px solid #ddd;
        }
        
        .responsive-table th {
            background-color: #3682f6;
            color: white;
            font-weight: bold;
        }
        
        .responsive-table tr:nth-child(even) {
            background-color: #fafafa;
        }
        
        .upload-form {
           width: 100%;
           max-width: 650px;
           margin: 20px auto;
           padding: 20px;
           border: 1px solid #ddd;
           border-radius: 4px;
        }

        .file-format {
            color: #666;
            font-size: 0.9em;
            margin-bottom: 15px;
        }

        .file-input-container {
            margin-bottom: 15px;
        }

        .radio-group {
            margin-bottom: 15px;
        }

        .upload-btn {
            padding: 8px 16px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }

        .download-btn {
            display: inline-block;
            padding: 6px 12px;
            background-color: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 4px;
        }

        @media screen and (max-width: 600px) {
           .sideBarTxt {
              display: none;
           }
           .right-align {
              display: none;
           }
           .responsive-table {
              border: 0;
           }
           .responsive-table thead {
              display: none;
           }
           .responsive-table tr {
              margin-bottom: 20px;
              display: block;
              border: 1px solid #ddd;
           }
            
            .responsive-table td {
                display: block;
                text-align: right;
                padding: 6px;
                border-bottom: 1px solid #ddd;
            }
            
            .responsive-table td:before {
                content: attr(data-label);
                float: left;
                font-weight: bold;
            }

            .upload-form {
               padding: 5px;
               margin: 0px;
            }
        }
    </style>
</head>
<body>
   {{template "sidebar_en" .}}
   <!-- 主內容區域 -->
   <main class="main-content">
      <div class="right-align">
         Hi，{{ .Userinfo.ChName }}（{{ .Userinfo.Email }}） |  
         <a href="/www/translate">中文</a>
      </div>
      <div class="container">
         <!-- 上傳表單 -->
         <form id="uploadForm" enctype="multipart/form-data" class="upload-form">
            <h2>Please select an audio file to upload.</h2>
            <div class="file-format">Format restrictions: mp3、wav</div>
            <div class="file-input-container">
               <input type="file" class="form-control-file" id="file" name="file" accept=".mp3,.wav" required>
               <small id="fileHelp" class="form-text text-muted">Please upload an MP3 file.</small>
            </div>
            <div class="radio-group">
               <div>Do you want to mark different speakers?</div>
               <label>
                  <input type="radio" style="margin:0;min-width:0;" name="multiplespeaker" value="0" checked> No 
               </label>
               <label>
                  <input type="radio" style="margin-left:15px;min-width:0;" name="multiplespeaker"value="1" > Yes 
               </label>
            </div>
            <button type="button" class="upload-btn" id="myButton" onclick="uploadFile()">Upload</button>
            <br>
            <div class="progress">
               <div id="progressBar" class="progress-bar" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
            </div>
            <div id="uploadStatus" class="mt-3"></div>
         </form>
         {{ $length := len .Jobs }}
         {{ if gt $length 0 }}
         <!-- 檔案列表表格 -->
         <table class="responsive-table">
            <thead>
               <tr>
                  <th>file name</th>
                  <th>work type</th>
                  <th>current status</th>
                  <th>start time</th>
                  <th>end time</th>
                  <th>result download</th>
                  <th></th>
               </tr>
            </thead>
            <tbody id="files-list">
               {{range $i, $val := .Jobs}}
                  {{ $taskID := $val.TaskID }}
                  <tr id="row{{$i}}">
                     <td data-label="file name" title="{{ $taskID }}">{{ $val.FileName }}</td>
                     <td data-label="work type">{{ $val.Action }}</td>
                     <td data-label="current status">{{ $val.Status }}</td>
                     <td data-label="start time">{{ $val.UploadTime }}</td>
                     <td data-label="end time">{{ $val.FinishTime }}&nbsp;</td>
                     <td data-label="result download" id="Job{{ $taskID }}">
                        {{ $length := len $val.Results }}
                        {{ if gt $length 0 }}
                           {{ $items := mkSlice "TXT" "SRT" "VTT" "TSV" "JSON" }}
                           {{ range $items }}
                              <li><a href="/result/{{ $taskID }}/{{ . }}" target=_blank>{{ . }}</a></li>
                           {{ end }}
                        {{ end }} &nbsp;
                     </td>
                     <td data-label="Delete file">
                        <a href="javascript:del('{{ $taskID }}');" title="delete file">
                           <font color="red"><i class='bx bxs-message-rounded-x'></i></font></a>
                     </td>
                  </tr>
                  {{end}}
            </tbody>
         </table>
         {{ end }}
      </div>
   </main>
<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.5.3/dist/umd/popper.min.js"></script>
<script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
<script>
   var needReload = false;  // 是否需要重新更新表格
   // 側邊欄縮放功能
   const sidebar = document.querySelector('.sidebar');
   const mainContent = document.querySelector('.main-content');
   function insertRow(item) {
      if (!item || item.length === 0) {  return; }
      const table = document.getElementById('files-list');
      if(!table) self.location.reload();

      const row = document.createElement("tr");
      var nameCell = document.createElement("td");
      nameCell.textContent = item.fileName || ' ';
      row.appendChild(nameCell);

      var ageCell = document.createElement("td");
      ageCell.textContent = item.action || " ";
      row.appendChild(ageCell);

      var ageCell = document.createElement('td');
      ageCell.textContent = item.status || " ";
      row.appendChild(ageCell);

      var ageCell = document.createElement('td');
      ageCell.textContent = item.uploadTime || " ";
      row.appendChild(ageCell);

      // finish time
      var ageCell = document.createElement('td');
      ageCell.textContent = item.finishTime || " ";
      row.appendChild(ageCell);

      var ageCell = document.createElement('td');
      var s = "";
      if(item.results && item.results.length > 0) {
         item.results.forEach(function(link) {
            let l = link.split("/");
            s += "<li><a href='/result/" + item.taskID + "/" + l[l.length-2] + "'>" + l[l.length-2] + "</a></li>\n";
         });
      } else {
         s = " ";
      }
      ageCell.innerHTML = s;
      row.appendChild(ageCell);
      // delete
      var ageCell = document.createElement('td');
      var deleteLink = document.createElement('a');
      deleteLink.href = "javascript:del('" + item.taskID + "');";
      var fontElement = document.createElement('font');
      fontElement.color = "red";
      var iconElement = document.createElement('i');
      iconElement.className = 'bx bxs-message-rounded-x';
      fontElement.appendChild(iconElement);
      deleteLink.appendChild(fontElement);

       ageCell.appendChild(deleteLink);
       row.appendChild(ageCell);
       row.classList.add('highlight');
       if(!table.rows || table.rows.length === 0) {
          table.appendChild(row);
       } else {
          table.insertBefore(row, table.firstChild); // 插入到第一行位置
       }
       // 五秒后移除高亮颜色
       setTimeout(function() {
          row.classList.remove('highlight');
       }, 10000);
   }


   function generateTable(data) {
      if (!data || data.length === 0) {  return; }
      const table = document.getElementById('files-list');
      table.innerHTML = '';


      data.forEach(function(item) {
          const row = document.createElement("tr");
          var nameCell = document.createElement("td");
          nameCell.setAttribute("title", item.taskID);
          nameCell.textContent = item.fileName || ' ';
          row.appendChild(nameCell);

          var ageCell = document.createElement("td");
          ageCell.textContent = item.action || " ";
          row.appendChild(ageCell);

          var ageCell = document.createElement('td');
          ageCell.textContent = item.status || " ";
          row.appendChild(ageCell);

          var ageCell = document.createElement('td');
          ageCell.textContent = item.uploadTime || " ";
          row.appendChild(ageCell);

          // finish time
          var ageCell = document.createElement('td');
          ageCell.textContent = item.finishTime || " ";
          row.appendChild(ageCell);

          var ageCell = document.createElement('td');
          var s = "";
          if(item.results && item.results.length > 0) {
             item.results.forEach(function(link) {
                let l = link.split("/"); 
                s += "<li><a href='/result/" + item.taskID + "/" + l[l.length-2] + "'>" + l[l.length-2] + "</a></li>\n";
             });
          } else { 
             s = " ";
          }
          ageCell.innerHTML = s;
          row.appendChild(ageCell);
          // delete
          var ageCell = document.createElement('td');
          var deleteLink = document.createElement('a');
          deleteLink.href = "javascript:del('" + item.taskID + "');";
          // deleteLink.textContent = 'Delete';

          var fontElement = document.createElement('font');
          fontElement.color = "red";

          var iconElement = document.createElement('i');
          iconElement.className = 'bx bxs-message-rounded-x';
          fontElement.appendChild(iconElement);

          deleteLink.appendChild(fontElement);

          ageCell.appendChild(deleteLink);
          row.appendChild(ageCell);
          
          if (table.rows.length === 0) {
             table.appendChild(row);
          } else {
             table.insertBefore(row, table.firstChild); // 插入到第一行位置
          }
      });
   }

   function generateList(data) {
      console.log(data);
      var listContainer = document.getElementById('jobLists');
      if(!listContainer)  return;
      listContainer.innerHTML = '';
      data.forEach(function(item) {
         var listItem = document.createElement('li');
         listItem.textContent = item.name; // 假設JSON資料中有一個名為'name'的屬性
         listContainer.appendChild(listItem); // 將li元素添加到列表容器中
      });
   }
   
   // Function to get the value of the 'multiplespeaker' radio buttons
   function getMultiplespeakerValue() {
       const radios = document.getElementsByName('multiplespeaker');
       for(let i = 0; i < radios.length; i++) {
           if(radios[i].checked) {
              return radios[i].value;
           }
       }
       return 0;
   }

   function del(id) {
      if(!id || !confirm("Are you sure you want to delete this record?")) return;
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/del/' + id, true);
      xhr.onload = function(evt) {
         if(xhr.status === 200) {
            console.log(xhr.responseText);
            self.location.reload();
         } else {
            alert('Delete failed');
         }
      };
      xhr.onerror = function () {
         alert("delete error");
      };
      xhr.send();
   }

   function uploadFile() {
      var button = document.getElementById("myButton");
      button.disabled = true; // Disable
      button.textContent = 'File uploading in progress.....';
      var fileInput = document.getElementById('file');
      var file = fileInput.files[0];
      var formData = new FormData();
      const multiplespeaker = getMultiplespeakerValue();
      formData.append('file', file);
      formData.append('multiplespeaker', multiplespeaker);
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/upload', true);
      xhr.upload.onprogress = function (e) {
         if(e.lengthComputable) {
            var progress = (e.loaded / e.total) * 100;
            document.getElementById('progressBar').style.width = progress + '%';
            document.getElementById('progressBar').innerText = Math.round(progress) + '%';
         }
      };
      xhr.onload = function () {
         if(xhr.status === 200) {
            var responseData = JSON.parse(xhr.responseText);
            if(responseData)  {
               insertRow(responseData);
               alert("Upload success");
            } else {
               alert("Upload failed");
            }
         } else {
            document.getElementById('uploadStatus').innerText = 'Upload failed';
         }
         document.getElementById('progressBar').style.width = '0%';
         document.getElementById('progressBar').innerText = '0%';
         button.disabled = false;
         button.textContent = 'Upload';
         document.getElementById('uploadForm').reset();
       };
       xhr.onerror = function () {
          document.getElementById('uploadStatus').innerText = 'Upload failed';
          document.getElementById('progressBar').style.width = '0%';
          document.getElementById('progressBar').innerText = '0%';
          button.disabled = false;
          document.getElementById('uploadForm').reset();
       };
       xhr.send(formData);
   }

   function validateForm() {
      var fileInput = document.getElementById('file');
      var filePath = fileInput.value;
      var allowedExtensions = /(\.wav)|(\.mp3)$/i;

      if(!allowedExtensions.exec(filePath)) {
          alert('Please upload an MP3 file.');
          fileInput.value = '';
          return false;
      }
      return true;
   }

   function cycleEvents() {
      $.ajax({ url: "/query/jobs", method: "GET",
         success:function(res){
            if(!res) { console.log(res); return; }
            var events;
            if (typeof res === 'string') { events = JSON.parse(res); }
            else { events = res; }
            if(needReload) {
               generateTable(events);
               return;
            }
            if(events && events.length > 0) {
               for(var i = 0; i < events.length; i++)  {
                  let event = events[i]; 
                  var s = "";
                  if(!event.results || event.results.length == 0)   continue;
                  event.results.forEach(function(link) {
                     let l = link.split("/");
                     s += "<li><a href='/result/" + event.taskID + "/" + l[l.length-2] + "' target=_blank>" + l[l.length-2] + "</a></li>\n";
                  });
                  var elem = document.querySelector("#Job" + event.taskID);
                  if(!elem)  { needReload = true; return; }
                  elem.innerHTML = s;
               }
            } else {
               console.log("No event");
               console.log(res);
            }
         },
         error:function(err) {
            console.log(err)
         }
      });
   }
   
   function moveRowUp(row) {
      const prevRow = row.previousElementSibling;
      if(prevRow) {
         row.classList.add('moving-up');
         prevRow.classList.add('moving-down');

         setTimeout(() => {
            row.parentNode.insertBefore(row, prevRow);
            row.classList.remove('moving-up');
            prevRow.classList.remove('moving-down');
         }, 300);
      }
   }

   function moveRowDown(row) {
      const nextRow = row.nextElementSibling;
      if(nextRow) {
         row.classList.add('moving-down');
         nextRow.classList.add('moving-up');

         setTimeout(() => {
            row.parentNode.insertBefore(nextRow, row);
            row.classList.remove('moving-down');
            nextRow.classList.remove('moving-up');
         }, 400);
      }
   }
   
   var timeoutID;
   $(document).ready(function() {
      timeoutID = window.setInterval(cycleEvents, 30000);
   });
        
   // 移動設備上的側邊欄處理
   if(window.innerWidth <= 768) {
      sidebar.classList.add('collapsed');
      mainContent.classList.add('expanded');
   }
</script>
</body>
</html>
