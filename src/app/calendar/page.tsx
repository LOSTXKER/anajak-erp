/**
 * Production Calendar Page
 */

'use client'

import { useEffect, useState } from 'react'
import { Calendar, Package, Truck, CheckCircle } from 'lucide-react'

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    // Get current month range
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    fetch(`/api/calendar/production?start=${start.toISOString()}&end=${end.toISOString()}`)
      .then(res => res.json())
      .then(data => {
        setEvents(data)
        setLoading(false)
      })
  }, [currentDate])

  const eventsByDate: any = {}
  events.forEach(event => {
    if (event.date) {
      const dateKey = new Date(event.date).toDateString()
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = []
      }
      eventsByDate[dateKey].push(event)
    }
  })

  // Generate calendar days
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  const calendarDays = []
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i)
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Calendar className="h-8 w-8 text-indigo-600" />
            ปฏิทินการผลิต
          </h1>
          <p className="text-gray-500 mt-1">ดูกำหนดการผลิตและจัดส่ง</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← เดือนก่อน
          </button>
          <div className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg">
            {currentDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })}
          </div>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            เดือนถัดไป →
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-200">
        <span className="text-sm font-medium text-gray-700">หมายเหตุ:</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span className="text-sm text-gray-600">กำหนดส่ง Order</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-500 rounded"></div>
          <span className="text-sm text-gray-600">งานผลิต</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-sm text-gray-600">จัดส่ง</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-sm text-gray-600">ด่วน/Priority</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-7 gap-2">
          {/* Weekday headers */}
          {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
            <div key={day} className="text-center font-semibold text-gray-700 py-2">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square"></div>
            }

            const date = new Date(year, month, day)
            const dateKey = date.toDateString()
            const dayEvents = eventsByDate[dateKey] || []
            const isToday = date.toDateString() === new Date().toDateString()

            return (
              <div
                key={day}
                className={`aspect-square border rounded-lg p-2 ${
                  isToday ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'
                } hover:shadow-sm transition-shadow`}
              >
                <div className={`text-sm font-medium mb-1 ${
                  isToday ? 'text-indigo-600' : 'text-gray-900'
                }`}>
                  {day}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event: any) => {
                    const colorClass = event.color === 'red' ? 'bg-red-500' :
                                     event.color === 'blue' ? 'bg-blue-500' :
                                     event.color === 'purple' ? 'bg-purple-500' :
                                     event.color === 'green' ? 'bg-green-500' :
                                     'bg-gray-500'

                    return (
                      <div
                        key={event.id}
                        className={`${colorClass} text-white text-xs px-1.5 py-0.5 rounded truncate`}
                        title={event.title}
                      >
                        {event.title.substring(0, 15)}...
                      </div>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500 text-center">
                      +{dayEvents.length - 3} เพิ่ม
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">กิจกรรมที่จะถึง (7 วันข้างหน้า)</h2>
        <div className="space-y-3">
          {events
            .filter(e => {
              const eventDate = new Date(e.date)
              const weekFromNow = new Date()
              weekFromNow.setDate(weekFromNow.getDate() + 7)
              return eventDate >= new Date() && eventDate <= weekFromNow
            })
            .slice(0, 10)
            .map(event => (
              <div key={event.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${
                  event.color === 'red' ? 'bg-red-500' :
                  event.color === 'blue' ? 'bg-blue-500' :
                  event.color === 'purple' ? 'bg-purple-500' :
                  event.color === 'green' ? 'bg-green-500' :
                  'bg-gray-500'
                }`}></div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{event.title}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(event.date).toLocaleDateString('th-TH', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                    {event.time && ` เวลา ${event.time}`}
                  </p>
                </div>
              </div>
            ))}
          {events.length === 0 && (
            <p className="text-center text-gray-500 py-4">ไม่มีกิจกรรมในช่วงนี้</p>
          )}
        </div>
      </div>
    </div>
  )
}

