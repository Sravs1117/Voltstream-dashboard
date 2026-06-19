import os
import fitz

def create_pdf(filename, title, subtitle, sections):
    os.makedirs("data", exist_ok=True)
    filepath = os.path.join("data", filename)
    doc = fitz.open()
    
    # Page size: A4 (595 x 842 points)
    page = doc.new_page(width=595, height=842)
    
    # 1. Header Colored Banner (Teal `#00B4D8` -> RGB 0.0, 0.705, 0.847)
    page.draw_rect(fitz.Rect(0, 0, 595, 60), color=None, fill=(0.0, 0.705, 0.847), overlay=True)
    
    # Header Text
    page.insert_text((40, 36), "VOLTSTREAM SYSTEMS", fontname="hebo", fontsize=14, color=(1.0, 1.0, 1.0))
    page.insert_text((485, 35), "TECHNICAL MANUAL", fontname="helv", fontsize=8, color=(1.0, 1.0, 1.0))
    
    # 2. Footer
    page.draw_line((40, 790), (555, 790), color=(0.85, 0.85, 0.85), width=0.5)
    page.insert_text((40, 805), "VoltStream Corporation © 2026. Confidential Energy Document.", fontname="helv", fontsize=7.5, color=(0.6, 0.6, 0.6))
    page.insert_text((530, 805), "Page 1", fontname="hebo", fontsize=8, color=(0.6, 0.6, 0.6))
    
    # 3. Document Title Block
    page.insert_text((40, 95), title.upper(), fontname="hebo", fontsize=16, color=(0.06, 0.09, 0.16))
    page.insert_text((40, 112), subtitle, fontname="helvetica-oblique", fontsize=9, color=(0.4, 0.45, 0.5))
    
    # Accent Line under Title Block
    page.draw_line((40, 122), (555, 122), color=(0.0, 0.705, 0.847), width=1.5)
    
    # 4. Draw Sections (Dynamic flow layout to minimize white gaps)
    y_cursor = 135
    for sec_title, paragraphs in sections:
        # Section Header with left color accent block
        page.draw_rect(fitz.Rect(40, y_cursor, 44, y_cursor + 12), color=None, fill=(0.0, 0.705, 0.847), overlay=True)
        page.insert_text((48, y_cursor + 10), sec_title.upper(), fontname="hebo", fontsize=10.5, color=(0.06, 0.09, 0.16))
        
        # Section divider line
        page.draw_line((40, y_cursor + 16), (555, y_cursor + 16), color=(0.9, 0.9, 0.9), width=0.5)
        
        # Section Body (multi-paragraph formatting using dynamic bounding box)
        body_text = "\n\n".join(paragraphs)
        rect = fitz.Rect(40, y_cursor + 20, 555, 780)
        rv = page.insert_textbox(rect, body_text, fontname="helv", fontsize=8.2, color=(0.2, 0.2, 0.2))
        
        # Calculate the actual bottom y of this section's text
        actual_bottom_y = 780 - rv
        
        # Set start coordinate for the next section (15 points spacer)
        y_cursor = actual_bottom_y + 15
        
    doc.save(filepath)
    doc.close()
    print(f"Created styled PDF: {filepath}")

def main():
    # 1. energy_efficiency.pdf
    create_pdf(
        "energy_efficiency.pdf",
        "VoltStream Building Envelope and Climate Systems",
        "Guidelines for optimizing residential insulation, thermal barriers, and active HVAC heating and cooling setups.",
        [
            (
                "Building Envelope",
                [
                    "Air infiltration is another critical vector for thermal loss. Air Sealing: Up to 30% of heating and cooling energy is lost through small air leaks around joints, outlets, and frames. Using caulk and weatherstripping around windows and doors is the most cost-effective efficiency upgrade to seal these gaps, prevent drafts, and lower overall heating and cooling energy loss.",
                    "Improving the building envelope is the foundational step in modern residential energy management. The envelope separates the conditioned indoor environment from the unconditioned outdoor space. Thermal resistance of insulation materials is quantified by the R-value; higher R-values indicate greater capacity to resist heat flow.",
                    "Conducting a blower door test is highly recommended to identify localized leakage paths. Infrared thermal imaging during winter months can visually pinpoint structural voids and thermal anomalies where insulation has settled. Double-pane windows with low-emissivity (low-E) coatings and continuous exterior sheathing are standard upgrades."
                ]
            ),
            (
                "HVAC Systems",
                [
                    "Heating, Ventilation, and Air Conditioning (HVAC) systems are typically the single largest consumer of electricity in domestic buildings, often representing the largest portion of a utility bill. Smart management of HVAC setpoints is highly effective. Setting your thermostat to 18 degrees C (64 degrees F) during winter nights or while away can reduce annual heating costs by nearly 10%.",
                    "Modern air-source Heat Pumps are highly recommended: these advanced systems move heat between the indoors and outdoors rather than generating it from combustion, making them 3-4 times more efficient than traditional electric resistive furnaces.",
                    "Automating HVAC setbacks with smart thermostats ensures consistent execution. Sealing ductwork with mastic sealant reduces air leakage in unconditioned spaces, improving airflow efficiency. Target high-performance equipment with a SEER2 rating of 16 or higher, and implement motorized smart dampers for zoning control."
                ]
            ),
            (
                "LED Lighting",
                [
                    "Solid-state lighting technology offers substantial savings over legacy systems. Replacing incandescent bulbs with light-emitting diodes (LEDs) reduces lighting energy use by 75% and significantly extends the operational lifespan of the fixture. Best practices dictate installing occupancy sensors and always turning off lights when leaving a room.",
                    "LEDs are available in various color temperatures (2700K warm white to 5000K daylight) and have high CRI scores (>90) for superior visual clarity. Smart dimmer controls and schedules integrate lights with home automation platforms for additional savings.",
                    "Commercial and residential designs should target low lighting power density (LPD) metrics. Incorporating daylight harvesting sensors automatically dims artificial lights when ambient natural light is sufficient, yielding substantial secondary savings."
                ]
            )
        ]
    )

    # 2. solar_power.pdf
    create_pdf(
        "solar_power.pdf",
        "VoltStream Solar Power and Photovoltaic Systems",
        "Technical configurations for peak performance, degradation mitigation, and grid integration mechanisms.",
        [
            (
                "Solar Panel Installation",
                [
                    "The configuration of a photovoltaic (PV) solar array directly determines its output yield and overall return on investment. Standard installation parameters must be met to optimize the capture of solar irradiance. For peak annual performance of a residential solar array, the recommended panel angle should be equal to the local latitude, generally between 30 degrees and 45 degrees. Panels should face True South in the Northern Hemisphere to capture the highest amount of solar irradiance throughout the day.",
                    "Mitigating shade from surrounding structures is vital, as even minor shading on a single cell can disproportionately reduce overall string output. Utilizing microinverters or DC power optimizers allows each module to perform independently, optimizing output under variable shading conditions.",
                    "Azimuth angle alignment is equally critical: in the Northern Hemisphere, panels should face True South (180 degrees azimuth). Structures must also be engineered for local wind and snow loads to prevent physical deformation of the framing."
                ]
            ),
            (
                "Solar Panel Maintenance",
                [
                    "Environmental factors like dust accumulation, pollen, and debris will create soiling losses that degrade solar cell performance. Regular cleaning is crucial. Cleaning solar panels every 3 months increases overall output efficiency by 15% compared to uncleaned panels. It is recommended to use clean water and a soft squeegee to wash the glass face during early morning hours to avoid thermal shock to the cells.",
                    "Avoid abrasive cleaners or metal brushes that can scratch the anti-reflective glass coating. Professional annual electrical checks of junction boxes and wiring insulation help identify potential ground faults, ensuring safe, long-term system operation.",
                    "Annual thermal inspections using infrared cameras can identify hot spots caused by cell shading or bypass diode failures, preventing localized overheating and potential fire hazards while maintaining peak power output."
                ]
            ),
            (
                "Net Metering",
                [
                    "Grid-tied solar systems utilize net energy metering (NEM) policies. Net metering is a billing mechanism that allows solar owners to export excess electricity generated by their panels back to the local utility grid in exchange for credits. These credits are subsequently redeemed during periods of low production (such as night hours or winter months) to offset consumption.",
                    "Integrating a hybrid battery storage system allows solar owners to store excess power for use during high-tariff periods, rather than exporting it at lower net-metering buyback rates, maximizing financial self-sufficiency.",
                    "Under NEM 3.0 frameworks, exporting energy to the grid is less lucrative. Pairing PV arrays with intelligent battery storage enables energy arbitrage: storing cheap solar power during the day and discharging it during expensive peak hours."
                ]
            )
        ]
    )

    # 3. smart_meters.pdf
    create_pdf(
        "smart_meters.pdf",
        "VoltStream Smart Metering and Load Automation",
        "Advanced metering infrastructure, standby load analysis, and automated home appliance schedules.",
        [
            (
                "Smart Meter Tracking",
                [
                    "Modern power grids rely on Advanced Metering Infrastructure (AMI) to coordinate distribution. Smart meters monitor power consumption in real-time, transmitting usage data every 15 minutes to the utility provider. This high-frequency logging enables utility providers to offer dynamic pricing and allows homeowners to track their hourly consumption habits to locate waste.",
                    "Many utilities provide web-based dashboards showing historical patterns. Homeowners can link smart meters with Home Area Network (HAN) devices to view instantaneous power demand in watts directly on their smartphones.",
                    "Data collected by AMI systems is processed by Utility Meter Data Management Systems (MDMS) to flag billing anomalies. Homeowners can set up automated usage alerts to receive text notifications if daily consumption exceeds preset thresholds."
                ]
            ),
            (
                "Standby Load (Phantom Load)",
                [
                    "A significant amount of energy is wasted by devices that draw power when not in active use. Many household appliances consume electricity even when turned off or in standby mode. This is known as phantom load or standby load. Empirical research shows that turning off standby devices (phantom load) can save significant energy, as standby load accounts for up to 10% of residential energy usage. Smart plugs and power strips can automatically cut off power to devices in standby.",
                    "Common offenders include TV soundbars, gaming consoles, desktop computers, and chargers. Using advanced smart power strips detects when a primary device (like a TV) is off and automatically cuts power to secondary peripherals (like DVD players and speakers).",
                    "Measuring the home's baseline 'always-on' power draw using real-time CT sensors reveals the absolute minimum power consumed when the household is asleep. Minimizing this baseline is the fastest route to monthly utility bill reduction."
                ]
            ),
            (
                "Smart Plug Scheduling",
                [
                    "Integrating smart plugs with automated operational schedules is an effective strategy to eliminate phantom loads completely. Homeowners should establish schedules to power down home office setups, entertainment systems, and chargers overnight, cutting standby draw to zero.",
                    "Automated home routines can link smart plugs with occupancy sensors, shutting down specific outlets when a room is vacant for over 30 minutes, adding an extra layer of automation.",
                    "Using smart plugs equipped with built-in energy monitoring allows users to track the exact watt-hour consumption of individual appliances, exposing hidden energy hogs and enabling data-driven scheduling rules."
                ]
            )
        ]
    )

    # 4. peak_hours.pdf
    create_pdf(
        "peak_hours.pdf",
        "VoltStream Peak Demand and Load Shifting Guide",
        "Analyzing grid demand cycles, peak utility tariffs, and load migration strategies.",
        [
            (
                "Peak Electricity Hours",
                [
                    "Grid demand fluctuates dynamically throughout the day based on consumer behaviors. Peak electricity demand hours typically occur between 7 PM and 9 PM during summer and winter months. During these periods, the grid experiences the highest load, leading to grid stress, high market clearing prices, and the activation of inefficient peaker plants.",
                    "Pre-cooling or pre-heating the home prior to peak hours utilizing the thermal mass of walls and furniture helps maintain indoor temperatures while reducing active HVAC consumption during high-load intervals.",
                    "During extreme weather events, utilities issue critical peak pricing alerts. Participating in automated demand response programs allows the utility to temporarily adjust smart thermostats to help balance grid load in exchange for credits."
                ]
            ),
            (
                "Peak Tariffs",
                [
                    "To incentivize conservation, utility providers implement Time-of-Use (TOU) tariffs. Under these plans, peak pricing tariffs can double the cost of electricity per kWh during peak hours. Homeowners must monitor peak hours usage is essential to avoid high electricity bills.",
                    "Some residential plans include demand charges calculated on the single highest 15-minute average usage peak in a month. Flattening the peak demand profile is essential to mitigate these fixed capacity charges.",
                    "Implementing automated demand-side management (DSM) controllers dynamically sheds non-essential loads (like pool pumps) when total household demand spikes, ensuring consumption stays below tariff-triggering thresholds."
                ]
            ),
            (
                "Load Shifting",
                [
                    "Consumers can mitigate high tariffs by rearranging appliance schedules. Shifting heavy appliance usage (e.g., washing machines, dishwashers, and water heaters) to off-peak hours (after 10 PM or before 6 AM) significantly reduces billing costs. Shift loads to off-peak to save money.",
                    "Modern smart appliances feature built-in delay-start options. Programming these units to start cycles at 2 AM ensures they operate during the cheapest off-peak electricity pricing band.",
                    "Electric vehicles (EVs) are major contributors to peak load. Setting EV chargers to 'smart-charge' only during off-peak hours (e.g., midnight to 6 AM) utilizes super-off-peak rates, saving hundreds of dollars annually."
                ]
            )
        ]
    )

    # 5. electricity_bills.pdf
    create_pdf(
        "electricity_bills.pdf",
        "VoltStream Billing Structures and Offset Optimization",
        "Deconstructing monthly billing invoices, consumption telemetry, and solar offset calculations.",
        [
            (
                "Billing Components",
                [
                    "Homeowners can manage utility costs more effectively by understanding their monthly invoices. Electricity bills consist of fixed connection charges, energy consumption charges (measured in kWh), and demand charges. Fixed charges cover grid maintenance, volumetric consumption charges cover energy used, and demand charges cover peak capacity requirements.",
                    "Volumetric rates are often tiered, where baseline usage is cheap and consumption beyond the threshold is billed at higher excess rates. Environmental franchise fees and grid taxes also influence the final cost.",
                    "Understanding the specific tariff rate schedule (e.g., E-1 vs TOU-C) printed on the statement is critical. Volumetric rates may increase significantly once baseline allocations are exceeded, making conservation during high tiers highly lucrative."
                ]
            ),
            (
                "Usage Monitoring",
                [
                    "Continuous analysis of telemetry data prevents billing surprises. Active monitoring of daily usage helps identify anomalies, reducing bill shock. Reviewing billing statements and comparing daily graphs can pinpoint exactly which appliances are driving up costs.",
                    "Current-transformer (CT) clamps installed in the main breaker panel can perform load disaggregation, separating refrigerator, water heater, and dryer usage profiles using machine learning algorithms.",
                    "Integrating the dashboard with historical weather data allows users to normalize their consumption graphs against heating degree days (HDD), showing whether billing changes are driven by appliance efficiency or outdoor temperatures."
                ]
            ),
            (
                "Solar Offsets",
                [
                    "Photovoltaic production offsets volumetric utility purchases. Solar energy offsets can reduce net grid draw to zero or create utility credits. Setting up smart schedules to run heavy loads when solar generation is highest (typically 11 AM to 2 PM) maximizes self-consumption and solar offsets.",
                    "Using solar diverters to direct excess solar power to heat domestic water tanks acts as a thermal battery, storing solar power for later use and avoiding low grid feed-in rates.",
                    "Maximizing self-consumption requires aligning heavy thermal loads (like water heating and pool pumping) directly with the midday solar generation curve, reducing grid imports when net-metering buyback credits are low."
                ]
            )
        ]
    )

if __name__ == "__main__":
    main()
