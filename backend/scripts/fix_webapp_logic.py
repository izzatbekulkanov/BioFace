import sys
import re

def fix_telegram_webapp():
    file_path = '/home/smartgate/BioFace/backend/static/telegram_webapp/index.html'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Fix updateProfileDetails to show salary in profile
    old_profile_func_match = re.search(r'function updateProfileDetails\(\) \{.*?(?=function openAvatarEditor|const user = employeeData)', content, re.DOTALL)
    if old_profile_func_match:
        # We'll just replace the whole function
        pass # Better to use string replace for safety
        
    old_profile_func = """
      const branchEl = document.getElementById('profile-branch-val');
      if (branchEl) {
        if (branchData && branchData.name) {
          branchEl.innerText = branchData.name;
        } else if (user.organization_name) {
          branchEl.innerText = user.organization_name;
        } else if (user.branch_name) {
          branchEl.innerText = user.branch_name;
        } else {
          branchEl.innerText = currentLang === 'UZ' ? 'Bosh ofis' : 'Главный офис';
        }
      }

      const profAvatar = document.getElementById('profile-avatar');
      if (profAvatar && user.image_url) {
        profAvatar.src = user.image_url;
      }
    }"""
    
    new_profile_func = """
      const branchEl = document.getElementById('profile-branch-val');
      if (branchEl) {
        if (branchData && branchData.name) {
          branchEl.innerText = branchData.name;
        } else if (user.organization_name) {
          branchEl.innerText = user.organization_name;
        } else if (user.branch_name) {
          branchEl.innerText = user.branch_name;
        } else {
          branchEl.innerText = currentLang === 'UZ' ? 'Bosh ofis' : 'Главный офис';
        }
      }
      
      const salaryRow = document.getElementById('row-profile-salary');
      const salaryVal = document.getElementById('profile-salary-val');
      if (salaryRow && salaryVal) {
        if (user.salary && parseFloat(user.salary) > 0) {
          const formatter = new Intl.NumberFormat(currentLang === 'UZ' ? 'uz-UZ' : 'ru-RU', {
            style: 'currency',
            currency: 'UZS',
            maximumFractionDigits: 0
          });
          salaryVal.innerText = formatter.format(parseFloat(user.salary));
          salaryRow.style.display = 'flex';
        } else {
          salaryRow.style.display = 'none';
        }
      }

      const profAvatar = document.getElementById('profile-avatar');
      if (profAvatar && user.image_url) {
        profAvatar.src = user.image_url;
      }
    }"""
    
    content = content.replace(old_profile_func, new_profile_func)

    # 2. Fix displaySelectedDayLogs to show daily statistics premium card
    old_display_logs = """function displaySelectedDayLogs(dayLogs, dateKey) {
      const container = document.getElementById('history-container');
      const titleElem = document.getElementById('lbl-selected-day-title');
      
      const parts = dateKey.split('-');
      const localParsedDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const formattedDate = _fmtDate[currentLang].format(localParsedDate);
      
      titleElem.innerText = `${currentLang === 'UZ' ? 'Kunlik jurnallar' : 'Журналы за день'}: ${formattedDate}`;

      if (dayLogs.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px 0; font-size: 13px;">${currentLang === 'UZ' ? "Ushbu kunda davomat qayd etilmagan" : "В этот день отметки отсутствуют"}</div>`;
        return;
      }"""
      
    new_display_logs = """function displaySelectedDayLogs(dayLogs, dateKey) {
      const container = document.getElementById('history-container');
      const titleElem = document.getElementById('lbl-selected-day-title');
      
      const parts = dateKey.split('-');
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      const localParsedDate = new Date(year, month, day);
      const formattedDate = _fmtDate[currentLang].format(localParsedDate);
      
      titleElem.innerText = `${currentLang === 'UZ' ? 'Kunlik statistika va jurnallar' : 'Статистика и журналы'}: ${formattedDate}`;

      // Build daily stats HTML if available
      let dailyStatsHtml = '';
      if (currentMonthAttendance && currentMonthAttendance.days) {
        const dayData = currentMonthAttendance.days.find(d => d.day === day);
        if (dayData) {
          const formatHrsMin = (sec) => {
            const hrs = Math.floor(sec / 3600);
            const mins = Math.floor((sec % 3600) / 60);
            if (currentLang === 'UZ') {
              if (hrs > 0) return `${hrs}s ${mins}d`;
              return `${mins} daqiqa`;
            } else {
              if (hrs > 0) return `${hrs}ч ${mins}м`;
              return `${mins} мин`;
            }
          };

          const workedStr = dayData.present ? formatHrsMin(dayData.worked_seconds || 0) : (currentLang === 'UZ' ? "Kelmagan" : "Отсутствовал");
          let statusText = currentLang === 'UZ' ? "Kutilyapti" : "Ожидание";
          let statusColor = "var(--text-muted)";
          
          if (dayData.status === 'present') { statusText = currentLang === 'UZ' ? "Keldi" : "Присутствовал"; statusColor = "#10b981"; }
          else if (dayData.status === 'absent') { statusText = currentLang === 'UZ' ? "Kelmagan" : "Отсутствовал"; statusColor = "#ef4444"; }
          else if (dayData.status === 'late') { statusText = currentLang === 'UZ' ? "Kechikkan" : "Опоздал"; statusColor = "#f59e0b"; }
          else if (dayData.status === 'holiday') { statusText = currentLang === 'UZ' ? "Dam olish" : "Выходной"; statusColor = "#38bdf8"; }
          else if (dayData.status === 'vacation') { statusText = currentLang === 'UZ' ? "Ta'til" : "Отпуск"; statusColor = "#a855f7"; }
          
          dailyStatsHtml = `
            <div class="glass-card history-item" style="margin-bottom: 16px; padding: 16px; border-radius: 20px; background: linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(30, 41, 59, 0.4) 100%); border: 1px solid rgba(56, 189, 248, 0.15); box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px;">
                <span style="color: var(--text-muted); font-size: 13px;">${currentLang === 'UZ' ? 'Kunlik natija' : 'Дневной результат'}</span>
                <span style="background: ${statusColor}22; color: ${statusColor}; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; border: 1px solid ${statusColor}44;">${statusText}</span>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <div style="color: var(--text-muted); font-size: 12px; margin-bottom: 4px;">${currentLang === 'UZ' ? 'Ishlagan vaqti' : 'Отработанное время'}</div>
                  <div class="stat-value" style="font-size: 16px;">${workedStr}</div>
                </div>
                <div>
                  <div style="color: var(--text-muted); font-size: 12px; margin-bottom: 4px;">${currentLang === 'UZ' ? 'Kechikish' : 'Опоздание'}</div>
                  <div class="stat-value" style="font-size: 16px; color: ${(dayData.late_seconds || 0) > 0 ? '#f59e0b !important' : 'inherit'};">${(dayData.late_seconds || 0) > 0 ? formatHrsMin(dayData.late_seconds) : '0'}</div>
                </div>
              </div>
            </div>
          `;
        }
      }

      if (dayLogs.length === 0) {
        container.innerHTML = dailyStatsHtml + `<div class="glass-card history-item" style="text-align: center; color: var(--text-muted); padding: 30px 0; font-size: 13px; border-radius: 20px;">${currentLang === 'UZ' ? "Ushbu kunda davomat qayd etilmagan" : "В этот день отметки отсутствуют"}</div>`;
        return;
      }

      let innerHTMLContent = dailyStatsHtml;
"""

    content = content.replace(old_display_logs, new_display_logs)
    
    # Need to find `container.innerHTML = '';` inside displaySelectedDayLogs and change it to `container.innerHTML = innerHTMLContent;`
    # Let's use regex to replace it properly
    content = re.sub(r"container\.innerHTML = '';\s*const logFrag = document\.createDocumentFragment\(\);", 
                     "container.innerHTML = innerHTMLContent;\n      const logFrag = document.createDocumentFragment();", 
                     content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("✅ WebApp logic fixed: Added daily statistics mode and fixed profile missing data.")

if __name__ == "__main__":
    fix_telegram_webapp()
