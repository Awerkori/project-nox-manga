with open('src/routes/scan/+page.server.ts', 'r') as f:
    content = f.read()

content = content.replace("await db.update(schema.scans)\n        .where(eq(schema.scans.id, scanId));\n    } catch (error: any) {\n      return fail(400, { message: error.message });\n    }\n\n    return { success: true, logoRemoved: true };", "await db.update(schema.scans).set({ logoId: null })\n        .where(eq(schema.scans.id, scanId));\n    } catch (error: any) {\n      return fail(400, { message: error.message });\n    }\n\n    return { success: true, logoRemoved: true };")

content = content.replace("await db.update(schema.scans)\n        .where(eq(schema.scans.id, scanId));\n    } catch (error: any) {\n      return fail(400, { message: error.message });\n    }\n\n    return { success: true, bannerRemoved: true };", "await db.update(schema.scans).set({ bannerId: null })\n        .where(eq(schema.scans.id, scanId));\n    } catch (error: any) {\n      return fail(400, { message: error.message });\n    }\n\n    return { success: true, bannerRemoved: true };")

content = content.replace("db.update(schema.scanChapterStages)\n          .where(and(", "db.update(schema.scanChapterStages).set({ notes })\n          .where(and(")

content = content.replace("if (status === 'RESOLVED') {\n      updateData.resolvedBy = locals.user!.id;", "const updateData: any = { status };\n    if (status === 'RESOLVED') {\n      updateData.resolvedBy = locals.user!.id;")

content = content.replace("if (chapterLabel !== null) updatePayload.chapterLabel = chapterLabel || null;", "const updatePayload: any = {};\n    if (chapterLabel !== null) updatePayload.chapterLabel = chapterLabel || null;")

with open('src/routes/scan/+page.server.ts', 'w') as f:
    f.write(content)

