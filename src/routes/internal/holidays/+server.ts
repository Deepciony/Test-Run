import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';

// ใช้ path ที่แน่นอน (Root Project)
const holidayFilePath = path.resolve('static/internal/holidays.json');

// Interface ให้ตรงกับ Frontend ที่ส่งมา
interface EventConfig {
    eventId: number | string;
    eventTitle: string;
    holidays: string[];
    excludeWeekends: boolean;
    rewards: any[];
    [key: string]: any;
}

function getConfigs(): EventConfig[] {
    try {
        if (!fs.existsSync(holidayFilePath)) {
            fs.writeFileSync(holidayFilePath, JSON.stringify([]));
            return [];
        }
        const data = fs.readFileSync(holidayFilePath, 'utf-8');
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error("Read Error:", e);
        return [];
    }
}

function saveConfigs(data: EventConfig[]) {
    try {
        fs.writeFileSync(holidayFilePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Write Error:", e);
    }
}

export async function GET() {
    return json(getConfigs());
}

// ✅ ใช้ POST เพื่อบันทึกหรืออัปเดต Config ของ Event
export async function POST({ request }: { request: Request }) {
    try {
        const newConfig: EventConfig = await request.json();
        console.log("📥 Saving Config for Event ID:", newConfig.eventId);

        const configs = getConfigs();

        // 🔍 ใช้ eventId เป็นตัวเช็ค (แทน date แบบเก่า)
        const index = configs.findIndex(c => String(c.eventId) === String(newConfig.eventId));

        if (index !== -1) {
            // เจอของเดิม -> อัปเดตทับ
            configs[index] = newConfig;
            console.log("🔄 Updated config for event:", newConfig.eventId);
        } else {
            // ไม่เจอ -> เพิ่มใหม่
            configs.push(newConfig);
            console.log("➕ Added config for event:", newConfig.eventId);
        }

        saveConfigs(configs);
        return json({ success: true });

    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error("❌ POST Error:", msg);
        return json({ success: false, error: msg }, { status: 500 });
    }
}

export async function DELETE({ request }: { request: Request }) {
    try {
        // รับค่า eventId ที่ส่งมา
        const { eventId } = await request.json();
        console.log("🗑️ Deleting Config for Event ID:", eventId);

        const configs = getConfigs();
        const initialLength = configs.length;

        // กรองเอาเฉพาะตัวที่ ID ไม่ตรงกัน (เท่ากับลบตัวที่ ID ตรงกันออก)
        // ใช้ String() เพื่อกันเหนียวเรื่อง Type (number vs string)
        const newConfigs = configs.filter(c => String(c.eventId) !== String(eventId));

        if (configs.length === newConfigs.length) {
            console.log("⚠️ Event config not found in JSON (Nothing to delete)");
        } else {
            saveConfigs(newConfigs);
            console.log("✅ Deleted config from JSON successfully");
        }

        return json({ success: true });

    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error("❌ DELETE Error:", msg);
        return json({ success: false, error: msg }, { status: 500 });
    }
}