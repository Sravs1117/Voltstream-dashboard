import os
import fitz

def create_pdf(filename, title, sections):
    os.makedirs("data", exist_ok=True)
    filepath = os.path.join("data", filename)
    doc = fitz.open()
    
    # Page 1
    page = doc.new_page()
    rect = fitz.Rect(50, 50, 550, 750)
    
    content = f"{title}\n\n"
    for sec_title, sec_text in sections:
        content += f"--- {sec_title} ---\n{sec_text}\n\n"
    
    content += "\nPage 1"
    page.insert_textbox(rect, content)
    
    doc.save(filepath)
    doc.close()
    print(f"Created PDF: {filepath}")

def main():
    # 1. energy_efficiency.pdf
    create_pdf(
        "energy_efficiency.pdf",
        "VoltStream Energy Efficiency Document",
        [
            ("Building Envelope", "Insulation effectiveness is measured by R-value; higher values indicate better thermal resistance. Attics in residential homes should ideally reach R-49 to R-60. Air Sealing: Up to 30% of heating and cooling energy is lost through small air leaks. Using caulk and weatherstripping around windows and doors is the most cost-effective efficiency upgrade."),
            ("HVAC Systems", "Heating and cooling often represent the largest portion of a utility bill. Setting your thermostat to 18 degrees C (64 degrees F) during winter nights or while away can reduce annual heating costs by nearly 10%. Heat Pumps: These systems move heat rather than generating it, making them 3-4 times more efficient than traditional electric furnaces."),
            ("LED Lighting", "Lighting: Replacing incandescent bulbs with LEDs reduces energy use by 75% and significantly extends the lifespan of the fixture. Always turn off lights when leaving a room.")
        ]
    )

    # 2. solar_power.pdf
    create_pdf(
        "solar_power.pdf",
        "VoltStream Solar Power Document",
        [
            ("Solar Panel Installation", "To maximize the output of a residential solar array, specific installation parameters must be met. For peak annual performance, the recommended panel angle should be equal to the local latitude, generally between 30 degrees and 45 degrees. Panels should face True South in the Northern Hemisphere to capture the highest amount of solar irradiance throughout the day."),
            ("Solar Panel Maintenance", "Dust, dirt, and debris accumulation can degrade solar panel output. Cleaning solar panels every 3 months increases overall output efficiency by 15% compared to uncleaned panels. Use clean water and a soft squeegee to clean them safely."),
            ("Net Metering", "This billing mechanism allows solar owners to send excess energy back to the grid for credits, which can be used when production is low.")
        ]
    )

    # 3. smart_meters.pdf
    create_pdf(
        "smart_meters.pdf",
        "VoltStream Smart Meters Document",
        [
            ("Smart Meter Tracking", "Smart meters monitor power consumption in real-time, transmitting usage data every 15 minutes to the utility provider. This allows users to track their consumption habits and find areas of waste."),
            ("Standby Load (Phantom Load)", "Many household appliances consume electricity even when turned off or in standby mode. This is known as phantom load or standby load. Research shows that turning off standby devices (phantom load) can save significant energy, as standby load accounts for up to 10% of residential energy usage. Smart plugs and power strips can automatically cut off power to devices in standby."),
            ("Smart Plug Scheduling", "Using smart plugs with automatic scheduling can eliminate phantom loads completely by powering down home office setups, entertainment systems, and chargers overnight.")
        ]
    )

    # 4. peak_hours.pdf
    create_pdf(
        "peak_hours.pdf",
        "VoltStream Peak Hours Document",
        [
            ("Peak Electricity Hours", "Peak electricity demand hours typically occur between 7 PM and 9 PM during summer and winter months. During these periods, the grid experiences the highest load, leading to grid stress."),
            ("Peak Tariffs", "Time-of-use pricing and peak pricing tariffs can double the cost of electricity per kWh during peak hours. Monitoring peak hours usage is essential to avoid high electricity bills."),
            ("Load Shifting", "Shifting heavy appliance usage (e.g., washing machines, dishwashers, and water heaters) to off-peak hours (after 10 PM or before 6 AM) significantly reduces billing costs. Shift loads to off-peak to save money.")
        ]
    )

    # 5. electricity_bills.pdf
    create_pdf(
        "electricity_bills.pdf",
        "VoltStream Electricity Bills Document",
        [
            ("Billing Components", "Electricity bills consist of fixed connection charges, energy consumption charges (measured in kWh), and demand charges. Understanding these components helps in reducing bills."),
            ("Usage Monitoring", "Active monitoring of daily usage helps identify anomalies, reducing bill shock. Reviewing billing statements and comparing daily graphs can pinpoint exactly which appliances are driving up costs."),
            ("Solar Offsets", "Solar energy offsets can reduce net grid draw to zero or create utility credits. Setting up smart schedules to run heavy loads when solar generation is highest (typically 11 AM to 2 PM) maximizes self-consumption.")
        ]
    )

if __name__ == "__main__":
    main()
