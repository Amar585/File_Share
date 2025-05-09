import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q");
    
    if (!query || query.trim() === "") {
      return NextResponse.json({ files: [] });
    }

    // Use a simpler approach for the Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Missing configuration" },
        { status: 500 }
      );
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    
    // For auth, we'll use a simpler approach 
    // Use the service role to get the current user
    const authClient = createClient(supabaseUrl, supabaseKey);
    
    // Create a special client with auth headers from cookies
    const cookieStore = cookies();
    const cookieString = cookieStore.toString();
    
    // Make a direct auth check
    const { data: { user: currentUser }, error: authError } = await authClient.auth.admin.getUserById(
      cookieStore.get('sb-user-id')?.value || ''
    );
    
    let userId = null;
    
    if (authCookie) {
      // Use the auth token to get the user
      const { data: userData } = await supabaseAdmin.auth.getUser(authCookie);
      userId = userData?.user?.id;
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Use a mock response for testing if needed
    // return NextResponse.json({
    //   files: [{
    //     id: "test-id",
    //     name: "Test File.pdf",
    //     path: "test-path",
    //     size: 1000,
    //     type: "application/pdf",
    //     user_id: userId,
    //     created_at: new Date().toISOString(),
    //     shared: true,
    //     section: "my-files"
    //   }],
    //   query,
    //   totalResults: 1
    // });

    // Search for user's files
    const { data: myFiles, error: myFilesError } = await supabaseAdmin
      .from("files")
      .select("*")
      .eq("user_id", userId)
      .ilike("name", `%${query}%`);

    if (myFilesError) {
      console.error("Error searching user files:", myFilesError);
      throw myFilesError;
    }

    // Search for files shared with user
    const { data: sharedFiles, error: sharedFilesError } = await supabaseAdmin
      .from("files")
      .select("*")
      .neq("user_id", userId)
      .eq("shared", true)
      .ilike("name", `%${query}%`);

    if (sharedFilesError) {
      console.error("Error searching shared files:", sharedFilesError);
      throw sharedFilesError;
    }

    // Process results to include section information
    const myFilesWithSection = (myFiles || []).map(file => ({
      ...file,
      section: "my-files"
    }));

    const sharedFilesWithSection = (sharedFiles || []).map(file => ({
      ...file,
      section: "shared-files"
    }));

    // Combine results
    const allResults = [...myFilesWithSection, ...sharedFilesWithSection];

    return NextResponse.json({
      files: allResults,
      query,
      totalResults: allResults.length
    });
  } catch (error: any) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to search files" },
      { status: 500 }
    );
  }
}
