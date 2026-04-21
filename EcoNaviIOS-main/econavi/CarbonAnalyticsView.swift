//
//  CarbonAnalyticsView.swift
//  econavi
//
//  Visual Carbon Analytics Dashboard — Phase 7B
//  Shows weekly emissions bar chart, transport mode breakdown, streaks, and monthly comparison.
//  Uses only native SwiftUI drawing (no external chart libraries required).
//

import SwiftUI

// MARK: - Main Analytics View

struct CarbonAnalyticsView: View {
    @EnvironmentObject var userDataManager: UserDataManager

    // Derived data
    private var weeklyData: [DayEmission] {
        aggregateLast7Days(from: userDataManager.tripEmissions)
    }

    private var modeBreakdown: [ModeSlice] {
        aggregateByMode(from: userDataManager.tripEmissionsThisMonth)
    }

    private var streakDays: Int {
        calculateGreenStreak(
            trips: userDataManager.tripEmissions,
            dailyLimitKg: userDataManager.monthlyBudgetKg / 30.0
        )
    }

    private var thisMonthKg: Double {
        userDataManager.monthlyCarbonEmissionKg
    }

    private var lastMonthKg: Double {
        estimateLastMonthKg(from: userDataManager.tripEmissions)
    }

    private var monthDelta: Double {
        guard lastMonthKg > 0 else { return 0 }
        return ((thisMonthKg - lastMonthKg) / lastMonthKg) * 100.0
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {

                // MARK: Header Stats Row
                HStack(spacing: 14) {
                    StatCard(
                        title: "This Month",
                        value: String(format: "%.1f kg", thisMonthKg),
                        icon: "leaf.fill",
                        color: thisMonthKg < userDataManager.monthlyBudgetKg ? .green : .red
                    )
                    StatCard(
                        title: "vs Last Month",
                        value: String(format: "%@%.0f%%", monthDelta <= 0 ? "" : "+", monthDelta),
                        icon: monthDelta <= 0 ? "arrow.down.right" : "arrow.up.right",
                        color: monthDelta <= 0 ? .green : .orange
                    )
                    StatCard(
                        title: "Green Streak",
                        value: "\(streakDays) day\(streakDays == 1 ? "" : "s")",
                        icon: "flame.fill",
                        color: streakDays >= 7 ? .green : (streakDays >= 3 ? .yellow : .secondary)
                    )
                }
                .padding(.horizontal)

                // MARK: Weekly Bar Chart
                WeeklyBarChartCard(data: weeklyData, budgetPerDayKg: userDataManager.monthlyBudgetKg / 30.0)
                    .padding(.horizontal)

                // MARK: Mode Breakdown
                ModeBreakdownCard(slices: modeBreakdown, totalKg: thisMonthKg)
                    .padding(.horizontal)

                // MARK: Trip History Summary
                TripHistorySummaryCard(
                    totalTrips: userDataManager.tripEmissionsThisMonth.count,
                    totalDistanceKm: userDataManager.tripEmissionsThisMonth.reduce(0) { $0 + $1.distance },
                    avgEmissionPerTripKg: userDataManager.tripEmissionsThisMonth.isEmpty ? 0 :
                        thisMonthKg / Double(userDataManager.tripEmissionsThisMonth.count)
                )
                .padding(.horizontal)

                // MARK: Eco Tips
                EcoTipsCard(monthDelta: monthDelta, topMode: modeBreakdown.first?.mode ?? "car")
                    .padding(.horizontal)

                Spacer(minLength: 32)
            }
            .padding(.top, 8)
        }
        .navigationTitle("Carbon Analytics")
        .navigationBarTitleDisplayMode(.large)
        .task {
            await userDataManager.fetchTripEmissions()
            await userDataManager.fetchTripEmissionsThisMonth()
        }
        .refreshable {
            await userDataManager.fetchTripEmissions()
            await userDataManager.fetchTripEmissionsThisMonth()
        }
    }
}

// MARK: - Stat Card

private struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)
            Text(value)
                .font(.system(size: 16, weight: .bold, design: .rounded))
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

// MARK: - Weekly Bar Chart

struct DayEmission: Identifiable {
    let id = UUID()
    let label: String       // e.g. "Mon"
    let date: Date
    let emissionKg: Double
}

private struct WeeklyBarChartCard: View {
    let data: [DayEmission]
    let budgetPerDayKg: Double

    private var maxKg: Double {
        max(data.map(\.emissionKg).max() ?? 1, budgetPerDayKg) * 1.2
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Last 7 Days")
                    .font(.headline.weight(.semibold))
                Spacer()
                Text(String(format: "%.1f kg total", data.reduce(0) { $0 + $1.emissionKg }))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            // Bar chart
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(data) { day in
                    VStack(spacing: 4) {
                        // Value label
                        if day.emissionKg > 0 {
                            Text(String(format: "%.1f", day.emissionKg))
                                .font(.system(size: 9, weight: .semibold, design: .rounded))
                                .foregroundStyle(.secondary)
                        }

                        // Bar
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(barGradient(for: day.emissionKg))
                            .frame(height: max(4, CGFloat(day.emissionKg / maxKg) * 120))
                            .animation(.spring(response: 0.5, dampingFraction: 0.7), value: day.emissionKg)

                        // Day label
                        Text(day.label)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 160)

            // Budget line legend
            HStack(spacing: 6) {
                Rectangle()
                    .fill(.orange.opacity(0.6))
                    .frame(width: 16, height: 2)
                Text(String(format: "Daily budget: %.1f kg", budgetPerDayKg))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func barGradient(for kg: Double) -> LinearGradient {
        let overBudget = kg > budgetPerDayKg
        return LinearGradient(
            colors: overBudget
                ? [Color.red.opacity(0.7), Color.orange]
                : [Color.green.opacity(0.6), Color.green],
            startPoint: .bottom,
            endPoint: .top
        )
    }
}

// MARK: - Mode Breakdown (Donut Chart)

struct ModeSlice: Identifiable {
    let id = UUID()
    let mode: String       // transport_mode raw value
    let emissionKg: Double
    let trips: Int
}

private struct ModeBreakdownCard: View {
    let slices: [ModeSlice]
    let totalKg: Double

    private let modeColors: [String: Color] = [
        "car": .red,
        "two_wheeler": .orange,
        "bus": .yellow,
        "metro": .blue,
        "walk": .green,
    ]

    private let modeIcons: [String: String] = [
        "car": "car.fill",
        "two_wheeler": "scooter",
        "bus": "bus.fill",
        "metro": "tram.fill",
        "walk": "figure.walk",
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("By Transport Mode")
                .font(.headline.weight(.semibold))

            if slices.isEmpty {
                Text("No trip data this month")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
            } else {
                HStack(spacing: 20) {
                    // Donut chart
                    ZStack {
                        ForEach(Array(donutSegments().enumerated()), id: \.offset) { _, seg in
                            Circle()
                                .trim(from: seg.start, to: seg.end)
                                .stroke(seg.color, style: StrokeStyle(lineWidth: 20, lineCap: .round))
                                .rotationEffect(.degrees(-90))
                        }

                        VStack(spacing: 2) {
                            Text(String(format: "%.1f", totalKg))
                                .font(.system(size: 20, weight: .bold, design: .rounded))
                            Text("kg CO₂")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(width: 120, height: 120)

                    // Legend
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(slices) { slice in
                            HStack(spacing: 8) {
                                Circle()
                                    .fill(modeColors[slice.mode] ?? .gray)
                                    .frame(width: 10, height: 10)
                                Image(systemName: modeIcons[slice.mode] ?? "questionmark")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .frame(width: 16)
                                Text(modeName(slice.mode))
                                    .font(.caption)
                                Spacer()
                                Text(String(format: "%.1f kg", slice.emissionKg))
                                    .font(.caption.weight(.semibold))
                            }
                        }
                    }
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func donutSegments() -> [(start: CGFloat, end: CGFloat, color: Color)] {
        guard totalKg > 0 else { return [] }
        var segments: [(start: CGFloat, end: CGFloat, color: Color)] = []
        var cursor: CGFloat = 0
        for slice in slices {
            let fraction = CGFloat(slice.emissionKg / totalKg)
            let gap: CGFloat = 0.008
            segments.append((
                start: cursor + gap,
                end: cursor + fraction - gap,
                color: modeColors[slice.mode] ?? .gray
            ))
            cursor += fraction
        }
        return segments
    }

    private func modeName(_ raw: String) -> String {
        switch raw {
        case "car": return "Car"
        case "two_wheeler": return "Two Wheeler"
        case "bus": return "Bus"
        case "metro": return "Metro"
        case "walk": return "Walking"
        default: return raw.capitalized
        }
    }
}

// MARK: - Trip History Summary

private struct TripHistorySummaryCard: View {
    let totalTrips: Int
    let totalDistanceKm: Double
    let avgEmissionPerTripKg: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Trip Summary")
                .font(.headline.weight(.semibold))

            HStack(spacing: 0) {
                summaryItem(icon: "number", title: "Trips", value: "\(totalTrips)")
                Divider().frame(height: 36)
                summaryItem(icon: "road.lanes", title: "Distance", value: String(format: "%.1f km", totalDistanceKm))
                Divider().frame(height: 36)
                summaryItem(icon: "leaf.arrow.circlepath", title: "Avg/Trip", value: String(format: "%.2f kg", avgEmissionPerTripKg))
            }
        }
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func summaryItem(icon: String, title: String, value: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Eco Tips Card

private struct EcoTipsCard: View {
    let monthDelta: Double
    let topMode: String

    private var tips: [String] {
        var t: [String] = []
        if monthDelta > 0 {
            t.append("Your emissions increased this month. Try replacing 1–2 car trips with public transit.")
        } else if monthDelta < -10 {
            t.append("Great progress! Your emissions dropped significantly this month. Keep it up! 🎉")
        }
        switch topMode {
        case "car":
            t.append("Cars account for most of your emissions. Carpooling can cut them by 50%.")
            t.append("Short trips under 3 km? Consider walking — zero emissions and good exercise.")
        case "two_wheeler":
            t.append("Two-wheelers are better than cars but metro is 5× cleaner per km.")
        default:
            t.append("You're already using green transport. Challenge a friend to do the same!")
        }
        return t
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "lightbulb.fill")
                    .foregroundStyle(.yellow)
                Text("Eco Tips")
                    .font(.headline.weight(.semibold))
            }

            ForEach(Array(tips.enumerated()), id: \.offset) { _, tip in
                HStack(alignment: .top, spacing: 8) {
                    Text("•")
                        .foregroundStyle(.secondary)
                    Text(tip)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

// MARK: - Data Aggregation Helpers

private func aggregateLast7Days(from trips: [TripEmission]) -> [DayEmission] {
    let cal = Calendar.current
    let today = cal.startOfDay(for: Date())
    let formatter = DateFormatter()
    formatter.dateFormat = "EEE"

    return (0..<7).reversed().map { offset in
        let date = cal.date(byAdding: .day, value: -offset, to: today)!
        let nextDay = cal.date(byAdding: .day, value: 1, to: date)!
        let dayTrips = trips.filter { $0.createdAt >= date && $0.createdAt < nextDay }
        let kg = dayTrips.reduce(0.0) { $0 + $1.carbonEmission } / 1000.0
        return DayEmission(label: formatter.string(from: date), date: date, emissionKg: kg)
    }
}

private func aggregateByMode(from trips: [TripEmission]) -> [ModeSlice] {
    var grouped: [String: (kg: Double, count: Int)] = [:]
    for trip in trips {
        let mode = trip.transportMode ?? "car"
        let current = grouped[mode] ?? (0, 0)
        grouped[mode] = (current.kg + trip.carbonEmission / 1000.0, current.count + 1)
    }
    return grouped.map { ModeSlice(mode: $0.key, emissionKg: $0.value.kg, trips: $0.value.count) }
        .sorted { $0.emissionKg > $1.emissionKg }
}

private func calculateGreenStreak(trips: [TripEmission], dailyLimitKg: Double) -> Int {
    let cal = Calendar.current
    let today = cal.startOfDay(for: Date())
    var streak = 0

    for offset in 0..<365 {
        let date = cal.date(byAdding: .day, value: -(offset + 1), to: today)!
        let nextDay = cal.date(byAdding: .day, value: 1, to: date)!
        let dayTrips = trips.filter { $0.createdAt >= date && $0.createdAt < nextDay }

        // A day with no trips counts as green
        let dayKg = dayTrips.reduce(0.0) { $0 + $1.carbonEmission } / 1000.0
        if dayKg <= dailyLimitKg {
            streak += 1
        } else {
            break
        }
    }
    return streak
}

private func estimateLastMonthKg(from trips: [TripEmission]) -> Double {
    let cal = Calendar.current
    let now = Date()
    guard let startThisMonth = cal.date(from: cal.dateComponents([.year, .month], from: now)),
          let startLastMonth = cal.date(byAdding: .month, value: -1, to: startThisMonth) else { return 0 }

    let lastMonthTrips = trips.filter { $0.createdAt >= startLastMonth && $0.createdAt < startThisMonth }
    return lastMonthTrips.reduce(0.0) { $0 + $1.carbonEmission } / 1000.0
}

// MARK: - Preview

#Preview {
    NavigationStack {
        CarbonAnalyticsView()
            .environmentObject(UserDataManager.shared)
    }
}
